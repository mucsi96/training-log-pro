package mucsi96.traininglog.goldenday;

import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.GoldenDayStats;

@RestController
@RequestMapping(value = "/golden-day", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
public class GoldenDayController {

  private final GoldenDayService goldenDayService;

  @GetMapping
  GoldenDayStats getStats() {
    return goldenDayService.getStats();
  }
}
