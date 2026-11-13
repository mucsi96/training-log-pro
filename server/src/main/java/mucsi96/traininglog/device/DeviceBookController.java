package mucsi96.traininglog.device;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletResponse;
import mucsi96.traininglog.api.DeviceBook;

@RestController
@RequestMapping("/device/books")
@RequiredArgsConstructor
public class DeviceBookController {

  private final DeviceService deviceService;
  private final DeviceBookStorage deviceBookStorage;

  @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  List<DeviceBook> listPendingBooks(
      @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
    DeviceEntity device = deviceService.authenticate(authorizationHeader);
    return deviceService.getPendingBooks(device.getId()).stream()
        .map(book -> DeviceBook.builder()
            .id(book.getId())
            .fileName(book.getFileName())
            .createdAt(book.getCreatedAt().withZoneSameInstant(ZoneOffset.UTC).toOffsetDateTime())
            .build())
        .toList();
  }

  @GetMapping("/{id}/file")
  void downloadBook(
      @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
      @PathVariable UUID id, HttpServletResponse response) throws IOException {
    DeviceEntity device = deviceService.authenticate(authorizationHeader);
    deviceBookStorage.download(device.getId(), id, book -> {
      response.setContentType(MediaType.parseMediaType(book.contentType()).toString());
      response.setContentLengthLong(book.size());
      response.setHeader(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
            .filename(book.fileName(), StandardCharsets.UTF_8)
            .build()
            .toString());
    }, response.getOutputStream());
  }

  @DeleteMapping("/{id}")
  ResponseEntity<Void> acknowledgeBook(
      @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
      @PathVariable UUID id) {
    DeviceEntity device = deviceService.authenticate(authorizationHeader);
    deviceService.removeBook(device.getId(), id);
    return ResponseEntity.noContent().build();
  }

  // The security chain for these endpoints does not cover the /error dispatch,
  // so errors must be rendered here to keep their original status code.
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<String> handleResponseStatus(ResponseStatusException exception) {
    return ResponseEntity.status(exception.getStatusCode()).body(exception.getReason());
  }
}
