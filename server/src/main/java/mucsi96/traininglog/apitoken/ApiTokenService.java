package mucsi96.traininglog.apitoken;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApiTokenService {

  private static final int TOKEN_BYTE_LENGTH = 48;

  private final ApiTokenRepository apiTokenRepository;
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
        .tokenHash(hashToken(token))
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

    if (!apiTokenRepository.existsByTokenHash(hashToken(token))) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid API token");
    }
  }

  private String generateSecureToken() {
    byte[] bytes = new byte[TOKEN_BYTE_LENGTH];
    new SecureRandom().nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  @SneakyThrows
  private String hashToken(String token) {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
    return HexFormat.of().formatHex(hash);
  }

  private ZonedDateTime now() {
    return ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
  }

  public record CreatedToken(ApiTokenEntity entity, String token) {
  }
}
