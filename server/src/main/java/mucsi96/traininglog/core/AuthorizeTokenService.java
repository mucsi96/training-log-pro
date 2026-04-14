package mucsi96.traininglog.core;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class AuthorizeTokenService {

  private static final int TOKEN_TTL_SECONDS = 300;

  private final ConcurrentHashMap<String, Instant> tokens = new ConcurrentHashMap<>();

  public String createToken() {
    String token = UUID.randomUUID().toString();
    tokens.put(token, Instant.now().plusSeconds(TOKEN_TTL_SECONDS));
    return token;
  }

  public boolean validateToken(String token) {
    Instant expiration = tokens.get(token);
    return expiration != null && Instant.now().isBefore(expiration);
  }

  @Scheduled(fixedDelay = 60000)
  public void cleanup() {
    tokens.entrySet().removeIf(entry -> Instant.now().isAfter(entry.getValue()));
  }
}
