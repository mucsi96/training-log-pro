package mucsi96.traininglog.settings;

import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.Settings;

@RestController
@RequestMapping(value = "/settings", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class SettingsController {

  private final SettingsService settingsService;

  @GetMapping
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  Settings getSettings() {
    return toResponse(settingsService.getCurrent());
  }

  @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  Settings updateSettings(@Valid @RequestBody Settings request) {
    SettingsEntity saved = settingsService.update(
        request.getPushupGoal(),
        request.getElevationGoal(),
        request.getReadingPagesGoal(),
        request.getDailyTaskGoal(),
        request.getLearningPathGoal());
    return toResponse(saved);
  }

  private Settings toResponse(SettingsEntity entity) {
    return Settings.builder()
        .pushupGoal(entity.getPushupGoal())
        .elevationGoal(entity.getElevationGoal())
        .readingPagesGoal(entity.getReadingPagesGoal())
        .dailyTaskGoal(entity.getDailyTaskGoal())
        .learningPathGoal(entity.getLearningPathGoal())
        .build();
  }
}
