package mucsi96.traininglog.pushups;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping(value = "/pushups", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class PushupController {

  private final PushupService pushupService;

  @GetMapping
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  List<PushupSetResponse> list(
      @RequestParam(required = false) @Positive Integer period,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    return pushupService.getSets(Optional.ofNullable(period), zoneId).stream()
        .map(set -> PushupSetResponse.builder()
            .createdAt(set.getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
            .count(set.getCount())
            .build())
        .toList();
  }

  @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  PushupSetResponse add(
      @Valid @RequestBody AddPushupSetRequest request,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    PushupSet saved = pushupService.addSet(request.getCount());
    return PushupSetResponse.builder()
        .createdAt(saved.getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
        .count(saved.getCount())
        .build();
  }

  @DeleteMapping("/{createdAtMillis}")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<Void> delete(@PathVariable long createdAtMillis) {
    ZonedDateTime createdAt = ZonedDateTime.ofInstant(Instant.ofEpochMilli(createdAtMillis), ZoneOffset.UTC);
    pushupService.deleteSet(createdAt);
    return ResponseEntity.noContent().build();
  }

  @Data
  public static class AddPushupSetRequest {
    @NotNull
    @Min(-500)
    @Max(500)
    private Integer count;
  }

  @Data
  @Builder
  public static class PushupSetResponse {
    private OffsetDateTime createdAt;
    private int count;
  }
}
