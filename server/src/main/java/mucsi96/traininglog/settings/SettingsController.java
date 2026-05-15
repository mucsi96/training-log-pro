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
import mucsi96.traininglog.api.GoldenDayGoal;

@RestController
@RequestMapping(value = "/settings", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class SettingsController {

  private final SettingsService settingsService;

  @GetMapping("/golden-day-goal")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  GoldenDayGoal getGoldenDayGoal() {
    return toResponse(settingsService.getCurrent());
  }

  @PutMapping(value = "/golden-day-goal", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  GoldenDayGoal updateGoldenDayGoal(@Valid @RequestBody GoldenDayGoal request) {
    SettingsEntity saved = settingsService.update(
        request.getPushupGoal(),
        request.getElevationGoal(),
        request.getReadingPagesGoal(),
        request.getPushupDefaultSetSize(),
        request.getPushupMaxSetSize());
    return toResponse(saved);
  }

  private GoldenDayGoal toResponse(SettingsEntity entity) {
    return GoldenDayGoal.builder()
        .pushupGoal(entity.getPushupGoal())
        .elevationGoal(entity.getElevationGoal())
        .readingPagesGoal(entity.getReadingPagesGoal())
        .pushupDefaultSetSize(entity.getPushupDefaultSetSize())
        .pushupMaxSetSize(entity.getPushupMaxSetSize())
        .build();
  }
}
