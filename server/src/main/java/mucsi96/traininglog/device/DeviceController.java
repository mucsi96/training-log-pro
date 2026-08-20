package mucsi96.traininglog.device;

import java.io.IOException;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.CreatedDevice;
import mucsi96.traininglog.api.Device;
import mucsi96.traininglog.api.DeviceBook;

@RestController
@RequestMapping(value = "/devices", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class DeviceController {

  private final DeviceService deviceService;

  @GetMapping
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  List<Device> listDevices(@RequestHeader("X-Timezone") ZoneId zoneId) {
    return deviceService.getDevices().stream()
        .map(device -> toResponse(device, zoneId))
        .toList();
  }

  @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  CreatedDevice createDevice(
      @Valid @RequestBody CreateDeviceRequest request,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    DeviceService.CreatedDevice created = deviceService.createDevice(request.getName().trim());
    return CreatedDevice.builder()
        .id(created.entity().getId())
        .name(created.entity().getName())
        .apiKey(created.apiKey())
        .createdAt(created.entity().getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
        .build();
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<Void> deleteDevice(@PathVariable UUID id) {
    deviceService.deleteDevice(id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping(value = "/{id}/books", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  DeviceBook uploadBook(
      @PathVariable UUID id,
      @RequestParam("file") MultipartFile file,
      @RequestHeader("X-Timezone") ZoneId zoneId) throws IOException {
    if (file.isEmpty() || file.getOriginalFilename() == null || file.getOriginalFilename().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing file");
    }
    DeviceBookEntity book = deviceService.addBook(
        id,
        file.getOriginalFilename(),
        file.getContentType() != null ? file.getContentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE,
        file.getBytes());
    return DeviceBook.builder()
        .id(book.getId())
        .fileName(book.getFileName())
        .createdAt(book.getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
        .build();
  }

  @DeleteMapping("/{id}/books/{bookId}")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<Void> removeBook(@PathVariable UUID id, @PathVariable UUID bookId) {
    deviceService.removeBook(id, bookId);
    return ResponseEntity.noContent().build();
  }

  private Device toResponse(DeviceEntity device, ZoneId zoneId) {
    List<DeviceBook> books = deviceService.getPendingBooks(device.getId()).stream()
        .map(book -> DeviceBook.builder()
            .id(book.getId())
            .fileName(book.getFileName())
            .createdAt(book.getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
            .build())
        .toList();
    return Device.builder()
        .id(device.getId())
        .name(device.getName())
        .createdAt(device.getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
        .books(books)
        .build();
  }

  @Data
  public static class CreateDeviceRequest {
    @NotBlank
    @Size(max = 255)
    private String name;
  }
}
