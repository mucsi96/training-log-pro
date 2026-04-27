package mucsi96.traininglog.core;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import lombok.Data;

@Data
@Configuration
@ConfigurationProperties(prefix = "playwright")
public class PlaywrightConfiguration {
  private String wsEndpoint;
}
