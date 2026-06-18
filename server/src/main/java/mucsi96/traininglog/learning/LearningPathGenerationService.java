package mucsi96.traininglog.learning;

import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.anthropic.client.AnthropicClient;
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.api.LearningPathContent;

@Service
@RequiredArgsConstructor
@Slf4j
public class LearningPathGenerationService {

  private final AnthropicClient anthropicClient;
  private final AnthropicConfiguration anthropicConfiguration;
  private final ObjectMapper objectMapper;

  private static final String SYSTEM_PROMPT = """
      You are an expert instructional designer. From the user's request, produce a structured, \
      practical online learning path that someone can follow end to end.

      Respond with ONLY a single JSON object, no prose and no markdown fences, matching exactly \
      this shape:
      {"summary": string, "topics": [{"title": string, "blocks": [{"type": string, \
      "title": string, "description": string, "url": string}]}]}

      Rules:
      - "summary" is one or two sentences describing the overall path.
      - Order topics from foundational to advanced.
      - Each block "type" must be one of: video, article, practice, course, other.
      - "description" is a short sentence on what to do in that block.
      - "url" should be a real, well-known reference link when one fits, otherwise omit it.
      - Do not include "id" or "completed" fields; they are managed by the application.
      """;

  public LearningPathContent generate(String prompt, LearningPathContent current) {
    StringBuilder userMessage = new StringBuilder();
    if (current != null) {
      userMessage.append("Refine the following existing learning path according to the ")
          .append("instruction below. Keep what still fits and return the complete updated path.\n\n")
          .append("Current path JSON:\n")
          .append(serialize(current))
          .append("\n\nInstruction: ");
    }
    userMessage.append(prompt);

    MessageCreateParams params = MessageCreateParams.builder()
        .model(anthropicConfiguration.getModel())
        .maxTokens(8000L)
        .system(SYSTEM_PROMPT)
        .addUserMessage(userMessage.toString())
        .build();

    Message message = anthropicClient.messages().create(params);

    String json = stripCodeFences(message.content().stream()
        .map(ContentBlock::text)
        .filter(Optional::isPresent)
        .map(text -> text.get().text())
        .collect(Collectors.joining())
        .trim());

    try {
      return objectMapper.readValue(json, LearningPathContent.class);
    } catch (JsonProcessingException e) {
      log.error("Failed to parse learning path JSON from model: {}", json, e);
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
          "The AI returned an invalid learning path", e);
    }
  }

  private String serialize(LearningPathContent content) {
    try {
      return objectMapper.writeValueAsString(content);
    } catch (JsonProcessingException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
          "Unable to serialize learning path", e);
    }
  }

  private String stripCodeFences(String text) {
    String trimmed = text.trim();
    if (!trimmed.startsWith("```")) {
      return trimmed;
    }
    int firstNewline = trimmed.indexOf('\n');
    if (firstNewline >= 0) {
      trimmed = trimmed.substring(firstNewline + 1);
    }
    if (trimmed.endsWith("```")) {
      trimmed = trimmed.substring(0, trimmed.length() - 3);
    }
    return trimmed.trim();
  }
}
