package mucsi96.traininglog.learning;

import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.anthropic.client.AnthropicClient;
import com.anthropic.core.JsonValue;
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.JsonOutputFormat;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
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

      Guidance:
      - "summary" is one or two sentences describing the overall path.
      - Order topics from foundational to advanced.
      - Each block "type" is one of: video, article, practice, course, other.
      - "description" is a short sentence on what to do in that block.
      - Provide a real, well-known reference "url" when one fits; otherwise omit it.
      """;

  // JSON schema the model output is constrained to. It intentionally omits the
  // "id" and "completed" block fields, which the application assigns and manages.
  private static final String RESPONSE_SCHEMA = """
      {
        "type": "object",
        "properties": {
          "summary": { "type": "string" },
          "topics": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "title": { "type": "string" },
                "blocks": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "enum": ["video", "article", "practice", "course", "other"]
                      },
                      "title": { "type": "string" },
                      "description": { "type": "string" },
                      "url": { "type": "string" }
                    },
                    "required": ["type", "title", "description"],
                    "additionalProperties": false
                  }
                }
              },
              "required": ["title", "blocks"],
              "additionalProperties": false
            }
          }
        },
        "required": ["summary", "topics"],
        "additionalProperties": false
      }
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
        .outputConfig(responseOutputConfig())
        .addUserMessage(userMessage.toString())
        .build();

    Message message = anthropicClient.messages().create(params);

    String json = message.content().stream()
        .map(ContentBlock::text)
        .filter(Optional::isPresent)
        .map(text -> text.get().text())
        .collect(Collectors.joining())
        .trim();

    try {
      return objectMapper.readValue(json, LearningPathContent.class);
    } catch (JsonProcessingException e) {
      log.error("Failed to parse learning path JSON from model: {}", json, e);
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
          "The AI returned an invalid learning path", e);
    }
  }

  // Constrains the response to the learning-path JSON schema (structured outputs),
  // so the model always returns valid JSON in the required shape - no prose, no
  // markdown fences, and no fields outside the schema.
  private OutputConfig responseOutputConfig() {
    JsonOutputFormat.Schema.Builder schema = JsonOutputFormat.Schema.builder();
    parseSchema().forEach((key, value) -> schema.putAdditionalProperty(key, JsonValue.from(value)));
    return OutputConfig.builder()
        .format(JsonOutputFormat.builder().schema(schema.build()).build())
        .build();
  }

  private Map<String, Object> parseSchema() {
    try {
      return objectMapper.readValue(RESPONSE_SCHEMA, new TypeReference<Map<String, Object>>() {});
    } catch (JsonProcessingException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
          "Invalid learning path response schema", e);
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
}
