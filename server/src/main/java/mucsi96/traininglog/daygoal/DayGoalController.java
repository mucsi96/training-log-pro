package mucsi96.traininglog.daygoal;

import java.time.ZoneId;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.DayGoalStats;

@RestController
@RequestMapping(value = "/day-goal", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
public class DayGoalController {

  private final DayGoalService dayGoalService;

  @GetMapping
  DayGoalStats getStats(@RequestHeader("X-Timezone") ZoneId zoneId) {
    return dayGoalService.getStats(zoneId);
  }

  @PostMapping("/celebrate")
  ResponseEntity<Void> markCelebrated(@RequestHeader("X-Timezone") ZoneId zoneId) {
    dayGoalService.markTodayCelebrated(zoneId);
    return ResponseEntity.noContent().build();
  }
}
