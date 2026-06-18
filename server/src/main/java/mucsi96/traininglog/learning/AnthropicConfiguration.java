package mucsi96.traininglog.learning;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;

import lombok.Getter;
import lombok.Setter;

// @Getter/@Setter rather than @Data so no generated toString() can leak apiKey.
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "anthropic")
public class AnthropicConfiguration {
  private String apiUri;
  private String apiKey;
  private String model;

  @Bean
  AnthropicClient anthropicClient() {
    return AnthropicOkHttpClient.builder()
        .apiKey(apiKey)
        .baseUrl(apiUri)
        .build();
  }
}
