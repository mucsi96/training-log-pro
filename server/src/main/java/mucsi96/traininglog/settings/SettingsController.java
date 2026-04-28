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

  private final GoldenDayGoalService goldenDayGoalService;

  @GetMapping("/golden-day-goal")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  GoldenDayGoal getGoldenDayGoal() {
    return toResponse(goldenDayGoalService.getCurrent());
  }

  @PutMapping(value = "/golden-day-goal", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  GoldenDayGoal updateGoldenDayGoal(@Valid @RequestBody GoldenDayGoal request) {
    GoldenDayGoalEntity saved = goldenDayGoalService.update(
        request.getPushupGoal(), request.getElevationGoal());
    return toResponse(saved);
  }

  private GoldenDayGoal toResponse(GoldenDayGoalEntity entity) {
    return GoldenDayGoal.builder()
        .pushupGoal(entity.getPushupGoal())
        .elevationGoal(entity.getElevationGoal())
        .build();
  }
}
