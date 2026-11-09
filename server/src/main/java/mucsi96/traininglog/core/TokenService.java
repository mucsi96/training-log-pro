package mucsi96.traininglog.core;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class TokenService {

  private static final int MAX_USES = 3;
  private static final long TTL_SECONDS = 60;

  private record TokenEntry(String username, Instant expiresAt, int remainingUses) {
  }

  private final Map<String, TokenEntry> tokens = new ConcurrentHashMap<>();

  public String generate(String username) {
    String tokenValue = UUID.randomUUID().toString();
    tokens.put(tokenValue, new TokenEntry(username, Instant.now().plusSeconds(TTL_SECONDS), MAX_USES));
    log.info("Generated token for user: {}", username);
    return tokenValue;
  }

  public String consume(String tokenValue) {
    TokenEntry entry = tokens.get(tokenValue);
    if (entry == null) {
      throw new IllegalArgumentException("Invalid token");
    }
    if (Instant.now().isAfter(entry.expiresAt())) {
      tokens.remove(tokenValue);
      throw new IllegalArgumentException("Token expired");
    }
    int remaining = entry.remainingUses() - 1;
    if (remaining <= 0) {
      tokens.remove(tokenValue);
    } else {
      tokens.put(tokenValue, new TokenEntry(entry.username(), entry.expiresAt(), remaining));
    }
    log.info("Consumed token for user: {} ({} uses remaining)", entry.username(), remaining);
    return entry.username();
  }
}
