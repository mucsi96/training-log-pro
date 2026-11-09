package mucsi96.traininglog.core;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EnvironmentController {
  @Value("${thunderforest-api-key:}")
  private String thunderforestApiKey;

  @GetMapping("/environment")
  public ConfigResponse getConfig() {
    return new ConfigResponse(thunderforestApiKey);
  }

  public record ConfigResponse(String thunderforestApiKey) {}
}
