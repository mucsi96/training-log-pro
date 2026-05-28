package mucsi96.traininglog.tasks;

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
import mucsi96.traininglog.api.DailyTask;
import mucsi96.traininglog.api.DailyTaskStatus;

@RestController
@RequestMapping(value = "/tasks", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class DailyTaskController {

  private final DailyTaskService dailyTaskService;
  private final Clock clock;

  @GetMapping
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  List<DailyTask> listTasks() {
    return dailyTaskService.listTasks().stream()
        .map(this::toResponse)
        .toList();
  }

  @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<DailyTask> addTask(@Valid @RequestBody TaskRequest request) {
    DailyTaskEntity saved = dailyTaskService.addTask(request.name().trim());
    DailyTask body = toResponse(saved);
    return ResponseEntity
        .status(HttpStatus.CREATED)
        .location(URI.create("/tasks/" + saved.getId()))
        .body(body);
  }

  @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  DailyTask renameTask(@PathVariable UUID id, @Valid @RequestBody TaskRequest request) {
    DailyTaskEntity saved = dailyTaskService.renameTask(id, request.name().trim());
    return toResponse(saved);
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<Void> deleteTask(@PathVariable UUID id) {
    dailyTaskService.deleteTask(id);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/today")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  List<DailyTaskStatus> listToday(@RequestHeader("X-Timezone") ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    DailyTaskService.TodayTasks snapshot = dailyTaskService.getTodayTasks(today);
    return snapshot.tasks().stream()
        .map(task -> DailyTaskStatus.builder()
            .id(task.getId())
            .name(task.getName())
            .completed(snapshot.completedTaskIds().contains(task.getId()))
            .build())
        .toList();
  }

  @PutMapping(value = "/{id}/completion", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<Void> setCompletion(
      @PathVariable UUID id,
      @Valid @RequestBody CompletionRequest request,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    dailyTaskService.setCompletion(id, today, request.completed());
    return ResponseEntity.noContent().build();
  }

  private DailyTask toResponse(DailyTaskEntity task) {
    return DailyTask.builder()
        .id(task.getId())
        .name(task.getName())
        .build();
  }

  public record TaskRequest(@NotBlank @Size(max = 255) String name) {
  }

  public record CompletionRequest(@NotNull Boolean completed) {
  }
}
