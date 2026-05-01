package mucsi96.traininglog.fitness;

import java.time.ZoneId;
import java.util.Optional;

import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.FitnessMeasurement;
import mucsi96.traininglog.api.FitnessTimeline;

@RestController
@RequestMapping(value = "/fitness", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
public class FitnessController {

  private final FitnessService fitnessService;

  @GetMapping
  FitnessTimeline getFitness(
      @RequestParam(required = false) @Positive Integer period,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    return FitnessTimeline.builder()
        .measurements(fitnessService.getFitness(Optional.ofNullable(period), zoneId).stream()
            .map(row -> FitnessMeasurement.builder()
                .date(row.getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
                .fitness(row.getFitness())
                .fatigue(row.getFatigue())
                .form(row.getForm())
                .build())
            .toList())
        .build();
  }
}
