package mucsi96.traininglog.learning;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Getter;
import lombok.Setter;

// @Getter/@Setter rather than @Data so no generated toString() can leak apiKey.
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "anthropic")
public class AnthropicConfiguration {
  private String apiUri;

  // Don't let the key be serialized (e.g. by Actuator/Jackson) even via its getter.
  @JsonIgnore
  private String apiKey;

  private String model;

  @Bean
  AnthropicClient anthropicClient() {
    return AnthropicOkHttpClient.builder()
        .apiKey(apiKey)
        .baseUrl(apiUri)
        .timeout(Duration.ofSeconds(60))
        .build();
  }
}
