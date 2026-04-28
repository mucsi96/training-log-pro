package mucsi96.traininglog.settings;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.GoldenDayGoal;
import mucsi96.traininglog.goldenday.GoldenDayService;

@RestController
@RequestMapping(value = "/settings", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class SettingsController {

  private final GoldenDayGoalService goldenDayGoalService;
  private final GoldenDayService goldenDayService;
  private final Clock clock;

  @GetMapping("/golden-day-goal")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  GoldenDayGoal getGoldenDayGoal() {
    return toResponse(goldenDayGoalService.getCurrent());
  }

  @PutMapping(value = "/golden-day-goal", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  GoldenDayGoal updateGoldenDayGoal(
      @Valid @RequestBody GoldenDayGoal request,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    LocalDate effectiveFrom = goldenDayService.isTodayGolden(zoneId) ? today.plusDays(1) : today;
    GoldenDayGoalEntity saved = goldenDayGoalService.save(
        request.getPushupGoal(), request.getElevationGoal(), effectiveFrom);
    return toResponse(saved);
  }

  private GoldenDayGoal toResponse(GoldenDayGoalEntity entity) {
    return GoldenDayGoal.builder()
        .pushupGoal(entity.getPushupGoal())
        .elevationGoal(entity.getElevationGoal())
        .build();
  }
}
