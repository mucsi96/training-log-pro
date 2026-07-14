package mucsi96.traininglog.apitoken;

import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.ApiToken;
import mucsi96.traininglog.api.CreatedApiToken;
import mucsi96.traininglog.apitoken.ApiTokenService.CreatedToken;

@RestController
@RequestMapping(value = "/api-tokens", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class ApiTokenController {

  private final ApiTokenService apiTokenService;

  @GetMapping
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  List<ApiToken> listTokens(@RequestHeader("X-Timezone") ZoneId zoneId) {
    return apiTokenService.getTokens().stream()
        .map(token -> toResponse(token, zoneId))
        .toList();
  }

  @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  CreatedApiToken createToken(
      @Valid @RequestBody CreateApiTokenRequest request,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    CreatedToken created = apiTokenService.createToken(request.getName().trim());
    return CreatedApiToken.builder()
        .id(created.entity().getId())
        .name(created.entity().getName())
        .token(created.token())
        .createdAt(created.entity().getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
        .build();
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<Void> deleteToken(@PathVariable UUID id) {
    apiTokenService.deleteToken(id);
    return ResponseEntity.noContent().build();
  }

  private ApiToken toResponse(ApiTokenEntity token, ZoneId zoneId) {
    return ApiToken.builder()
        .id(token.getId())
        .name(token.getName())
        .createdAt(token.getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
        .build();
  }

  @Data
  public static class CreateApiTokenRequest {
    @NotBlank
    @Size(max = 255)
    private String name;
  }
}
