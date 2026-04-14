package mucsi96.traininglog.core;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.ott.InMemoryOneTimeTokenService;
import org.springframework.security.authentication.ott.OneTimeTokenService;

@Configuration
public class OneTimeTokenBridgeConfiguration {

  @Bean
  OneTimeTokenService oneTimeTokenService() {
    return new InMemoryOneTimeTokenService();
  }
}
