package mucsi96.traininglog.device;

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
import mucsi96.traininglog.api.DeviceBook;

@RestController
@RequestMapping("/device/books")
@RequiredArgsConstructor
public class DeviceBookController {

  private final DeviceService deviceService;

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
  ResponseEntity<byte[]> downloadBook(
      @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
      @PathVariable UUID id) {
    DeviceEntity device = deviceService.authenticate(authorizationHeader);
    DeviceBookEntity book = deviceService.getBook(device.getId(), id);
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(book.getContentType()))
        .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
            .filename(book.getFileName(), StandardCharsets.UTF_8)
            .build()
            .toString())
        .body(book.getData());
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
