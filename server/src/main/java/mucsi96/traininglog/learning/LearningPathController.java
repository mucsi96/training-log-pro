package mucsi96.traininglog.learning;

import java.net.URI;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.LearningPath;
import mucsi96.traininglog.api.LearningPathContent;
import mucsi96.traininglog.api.LearningPathStatus;

@RestController
@RequestMapping(value = "/learning-paths", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class LearningPathController {

  private final LearningPathService learningPathService;
  private final Clock clock;

  @GetMapping
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  List<LearningPath> list() {
    return learningPathService.list().stream()
        .map(this::toResponse)
        .toList();
  }

  @GetMapping("/{id}")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  LearningPath get(@PathVariable UUID id) {
    return toResponse(learningPathService.get(id));
  }

  @PostMapping(value = "/generate", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  LearningPathContent generate(@Valid @RequestBody GenerateRequest request) {
    return learningPathService.generate(request.prompt().trim(), request.content());
  }

  @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<LearningPath> create(@Valid @RequestBody SaveRequest request) {
    LearningPathEntity saved = learningPathService.create(request.title().trim(), request.content());
    return ResponseEntity
        .status(HttpStatus.CREATED)
        .location(URI.create("/learning-paths/" + saved.getId()))
        .body(toResponse(saved));
  }

  @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  LearningPath update(@PathVariable UUID id, @Valid @RequestBody SaveRequest request) {
    return toResponse(learningPathService.update(id, request.title().trim(), request.content()));
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<Void> delete(@PathVariable UUID id) {
    learningPathService.delete(id);
    return ResponseEntity.noContent().build();
  }

  @PutMapping(value = "/{id}/blocks/{blockId}", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  LearningPath setBlockCompleted(
      @PathVariable UUID id,
      @PathVariable String blockId,
      @Valid @RequestBody BlockCompletionRequest request) {
    return toResponse(learningPathService.setBlockCompleted(id, blockId, request.completed()));
  }

  @GetMapping("/today")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  List<LearningPathStatus> listToday(@RequestHeader("X-Timezone") ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    LearningPathService.TodayPaths snapshot = learningPathService.getTodayPaths(today);
    return snapshot.paths().stream()
        .map(path -> LearningPathStatus.builder()
            .id(path.getId())
            .title(path.getTitle())
            .active(snapshot.activePathIds().contains(path.getId()))
            .build())
        .toList();
  }

  @PutMapping(value = "/{id}/activity", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<Void> setActivity(
      @PathVariable UUID id,
      @Valid @RequestBody ActivityRequest request,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    learningPathService.setActivity(id, today, request.active());
    return ResponseEntity.noContent().build();
  }

  private LearningPath toResponse(LearningPathEntity entity) {
    return LearningPath.builder()
        .id(entity.getId())
        .title(entity.getTitle())
        .content(entity.getContent())
        .createdAt(entity.getCreatedAt().toOffsetDateTime())
        .completedAt(entity.getCompletedAt() == null ? null : entity.getCompletedAt().toOffsetDateTime())
        .build();
  }

  public record GenerateRequest(
      @NotBlank @Size(max = 4000) String prompt,
      LearningPathContent content) {
  }

  public record SaveRequest(
      @NotBlank @Size(max = 255) String title,
      @NotNull LearningPathContent content) {
  }

  public record BlockCompletionRequest(@NotNull Boolean completed) {
  }

  public record ActivityRequest(@NotNull Boolean active) {
  }
}
