package mucsi96.traininglog.schedule;

import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.extern.slf4j.Slf4j;

/**
 * Thin client over the Anthropic Messages API. Used for both vision-based
 * extraction of meetings from a calendar photo and text-based planning of the
 * day schedule. The base URI is configurable so it can be pointed at a mock
 * server in tests.
 */
@Component
@Slf4j
public class AnthropicClient {

  private final RestClient restClient;
  private final String model;
  private final int maxTokens;

  public AnthropicClient(
      @Value("${anthropic.api-uri}") String apiUri,
      @Value("${anthropic.api-key}") String apiKey,
      @Value("${anthropic.api-version:2023-06-01}") String apiVersion,
      @Value("${anthropic.model:claude-opus-4-8}") String model,
      @Value("${anthropic.max-tokens:4000}") int maxTokens) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.restClient = RestClient.builder()
        .baseUrl(apiUri)
        .defaultHeader("x-api-key", apiKey)
        .defaultHeader("anthropic-version", apiVersion)
        .defaultHeader("content-type", MediaType.APPLICATION_JSON_VALUE)
        .build();
  }

  /** Sends a calendar photo plus an instruction and returns the model's text output. */
  public String extractFromImage(String prompt, byte[] image, String mediaType) {
    String base64 = Base64.getEncoder().encodeToString(image);
    Map<String, Object> imageBlock = Map.of(
        "type", "image",
        "source", Map.of(
            "type", "base64",
            "media_type", mediaType,
            "data", base64));
    Map<String, Object> textBlock = Map.of("type", "text", "text", prompt);
    return send(List.of(textBlock, imageBlock));
  }

  /** Sends a text-only instruction and returns the model's text output. */
  public String complete(String prompt) {
    return send(List.of(Map.of("type", "text", "text", prompt)));
  }

  private String send(List<Map<String, Object>> content) {
    Map<String, Object> body = Map.of(
        "model", model,
        "max_tokens", maxTokens,
        "messages", List.of(Map.of("role", "user", "content", content)));

    log.info("Calling Anthropic Messages API");
    MessagesResponse response = restClient.post()
        .uri("/v1/messages")
        .body(body)
        .retrieve()
        .body(MessagesResponse.class);

    if (response == null || response.content() == null) {
      throw new IllegalStateException("Empty Anthropic response");
    }

    return response.content().stream()
        .filter(block -> "text".equals(block.type()) && block.text() != null)
        .map(ContentBlock::text)
        .reduce("", String::concat);
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record MessagesResponse(List<ContentBlock> content) {
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record ContentBlock(String type, String text) {
  }
}
