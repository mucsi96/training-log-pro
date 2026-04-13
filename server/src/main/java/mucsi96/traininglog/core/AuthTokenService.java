package mucsi96.traininglog.core;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class AuthTokenService {

  private static final long TOKEN_TTL_SECONDS = 300;

  private record TokenEntry(String principalName, Instant expiresAt) {
  }

  private final Map<String, TokenEntry> tokens = new ConcurrentHashMap<>();

  public String generateToken(String principalName) {
    String token = UUID.randomUUID().toString();
    tokens.put(token, new TokenEntry(principalName, Instant.now().plusSeconds(TOKEN_TTL_SECONDS)));
    return token;
  }

  public String validateAndConsume(String token) {
    if (token == null) {
      return null;
    }
    TokenEntry entry = tokens.remove(token);
    if (entry == null || entry.expiresAt().isBefore(Instant.now())) {
      return null;
    }
    return entry.principalName();
  }

  @Scheduled(fixedRate = 60000)
  void cleanupExpiredTokens() {
    Instant now = Instant.now();
    tokens.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
  }
}
