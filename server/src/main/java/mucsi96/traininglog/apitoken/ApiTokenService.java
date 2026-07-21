package mucsi96.traininglog.apitoken;

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
public class ApiTokenService {

  private static final int TOKEN_BYTE_LENGTH = 48;

  private final ApiTokenRepository apiTokenRepository;
  private final TokenEncryptor tokenEncryptor;
  private final Clock clock;

  @Transactional(readOnly = true)
  public List<ApiTokenEntity> getTokens() {
    return apiTokenRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
  }

  @Transactional
  public CreatedToken createToken(String name) {
    String token = generateSecureToken();
    ApiTokenEntity entity = ApiTokenEntity.builder()
        .id(UUID.randomUUID())
        .name(name)
        .encryptedToken(tokenEncryptor.encrypt(token))
        .createdAt(now())
        .build();
    log.info("persisting api token {}", name);
    return new CreatedToken(apiTokenRepository.save(entity), token);
  }

  @Transactional
  public void deleteToken(UUID id) {
    if (!apiTokenRepository.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "API token not found");
    }
    apiTokenRepository.deleteById(id);
  }

  @Transactional(readOnly = true)
  public void validateBearerToken(String authorizationHeader) {
    if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or invalid Authorization header");
    }

    String token = authorizationHeader.substring(7);

    boolean tokenMatches = apiTokenRepository.findAllEncryptedTokens().stream()
        .anyMatch(encryptedToken -> constantTimeEquals(token, tokenEncryptor.decrypt(encryptedToken)));

    if (!tokenMatches) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid API token");
    }
  }

  private boolean constantTimeEquals(String presented, String stored) {
    return MessageDigest.isEqual(
        presented.getBytes(StandardCharsets.UTF_8),
        stored.getBytes(StandardCharsets.UTF_8));
  }

  private String generateSecureToken() {
    byte[] bytes = new byte[TOKEN_BYTE_LENGTH];
    new SecureRandom().nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private ZonedDateTime now() {
    return ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
  }

  public record CreatedToken(ApiTokenEntity entity, String token) {
  }
}
