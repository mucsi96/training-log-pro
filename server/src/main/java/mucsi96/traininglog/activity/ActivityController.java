package mucsi96.traininglog.activity;

import java.net.URI;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.Activity;
import mucsi96.traininglog.api.ActivityRequest;

@RestController
@RequestMapping(value = "/activities", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class ActivityController {

  private final ActivityService activityService;

  @GetMapping
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  List<Activity> list() {
    return activityService.list().stream().map(ActivityController::toResponse).toList();
  }

  @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<Activity> add(@Valid @RequestBody ActivityRequest request) {
    ActivityEntity saved = activityService.add(request);
    return ResponseEntity
        .status(HttpStatus.CREATED)
        .location(URI.create("/activities/" + saved.getId()))
        .body(toResponse(saved));
  }

  @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  Activity update(@PathVariable UUID id, @Valid @RequestBody ActivityRequest request) {
    return toResponse(activityService.update(id, request));
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ResponseEntity<Void> delete(@PathVariable UUID id) {
    activityService.delete(id);
    return ResponseEntity.noContent().build();
  }

  static Activity toResponse(ActivityEntity entity) {
    return Activity.builder()
        .id(entity.getId())
        .name(entity.getName())
        .durationMinutes(entity.getDurationMinutes())
        .occurrencesPerWeek(entity.getOccurrencesPerWeek())
        .locationId(entity.getLocationId())
        .earliestTime(entity.getEarliestTime())
        .latestTime(entity.getLatestTime())
        .daysOfWeek(entity.getDaysOfWeek())
        .constraintNote(entity.getConstraintNote())
        .priority(entity.getPriority())
        .build();
  }
}
