package mucsi96.traininglog.device;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.core.TokenEncryptor;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceService {

  private static final int KEY_BYTE_LENGTH = 48;

  private final DeviceRepository deviceRepository;
  private final DeviceBookRepository deviceBookRepository;
  private final TokenEncryptor tokenEncryptor;
  private final Clock clock;

  @Transactional(readOnly = true)
  public List<DeviceEntity> getDevices() {
    return deviceRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
  }

  @Transactional(readOnly = true)
  public List<DeviceBookSummary> getPendingBooks(UUID deviceId) {
    return deviceBookRepository.findByDeviceIdOrderByCreatedAtAsc(deviceId);
  }

  @Transactional
  public CreatedDevice createDevice(String name) {
    String apiKey = generateSecureKey();
    DeviceEntity entity = DeviceEntity.builder()
        .id(UUID.randomUUID())
        .name(name)
        .encryptedKey(tokenEncryptor.encrypt(apiKey))
        .createdAt(now())
        .build();
    log.info("persisting device {}", name);
    return new CreatedDevice(deviceRepository.save(entity), apiKey);
  }

  @Transactional
  public void deleteDevice(UUID id) {
    if (!deviceRepository.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Device not found");
    }
    deviceBookRepository.deleteByDeviceId(id);
    deviceRepository.deleteById(id);
  }

  @Transactional
  public DeviceBookEntity addBook(UUID deviceId, String fileName, String contentType, byte[] data) {
    if (!deviceRepository.existsById(deviceId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Device not found");
    }
    DeviceBookEntity book = DeviceBookEntity.builder()
        .id(UUID.randomUUID())
        .deviceId(deviceId)
        .fileName(fileName)
        .contentType(contentType)
        .data(data)
        .createdAt(now())
        .build();
    log.info("queueing book {} for device {}", fileName, deviceId);
    return deviceBookRepository.save(book);
  }

  @Transactional
  public void removeBook(UUID deviceId, UUID bookId) {
    DeviceBookEntity book = deviceBookRepository.findByIdAndDeviceId(bookId, deviceId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));
    deviceBookRepository.delete(book);
  }

  @Transactional(readOnly = true)
  public DeviceBookEntity getBook(UUID deviceId, UUID bookId) {
    return deviceBookRepository.findByIdAndDeviceId(bookId, deviceId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found"));
  }

  @Transactional(readOnly = true)
  public DeviceEntity authenticate(String authorizationHeader) {
    if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or invalid Authorization header");
    }

    String apiKey = authorizationHeader.substring(7);

    return deviceRepository.findAll().stream()
        .filter(device -> constantTimeEquals(apiKey, tokenEncryptor.decrypt(device.getEncryptedKey())))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid API key"));
  }

  private boolean constantTimeEquals(String presented, String stored) {
    return MessageDigest.isEqual(
        presented.getBytes(StandardCharsets.UTF_8),
        stored.getBytes(StandardCharsets.UTF_8));
  }

  private String generateSecureKey() {
    byte[] bytes = new byte[KEY_BYTE_LENGTH];
    new SecureRandom().nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private ZonedDateTime now() {
    return ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
  }

  public record CreatedDevice(DeviceEntity entity, String apiKey) {
  }
}
