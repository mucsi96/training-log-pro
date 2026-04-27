package mucsi96.traininglog.fitness;

import java.time.ZoneId;

import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.Fitness;

@RestController
@RequestMapping(value = "/fitness", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
public class FitnessController {

  private final FitnessService fitnessService;

  @GetMapping
  Fitness getFitness(@RequestHeader("X-Timezone") ZoneId zoneId) {
    return fitnessService.getFitness(zoneId);
  }
}
