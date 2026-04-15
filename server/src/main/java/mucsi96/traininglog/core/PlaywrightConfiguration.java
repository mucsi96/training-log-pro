package mucsi96.traininglog.core;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.Playwright;

import jakarta.annotation.PreDestroy;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

@Data
@Configuration
@ConfigurationProperties(prefix = "playwright")
@Slf4j
public class PlaywrightConfiguration {
  private String wsEndpoint;

  private Playwright playwright;

  @Bean
  @Lazy
  public Browser getBrowser() {
    playwright = Playwright.create();
    log.info("Connecting to remote Playwright server at {}", wsEndpoint);
    return playwright.chromium().connect(wsEndpoint);
  }

  @PreDestroy
  public void cleanup() {
    if (playwright != null) {
      playwright.close();
    }
  }
}
