package mucsi96.traininglog.weight;

import java.time.ZoneId;
import java.util.Optional;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.security.access.prepost.PreAuthorize;

import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.WeightHistory;
import mucsi96.traininglog.api.WeightMeasurement;

@RestController
@RequestMapping(value = "/weight", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
public class WeightController {

  private final WeightService weightService;

  @GetMapping
  WeightHistory weight(
      @RequestParam(required = false) @Positive Integer period,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    WeightService.WeightHistory history = weightService.getWeight(Optional.ofNullable(period), zoneId);
    return WeightHistory.builder()
        .measurements(history.measurements().stream().map(measurement -> toMeasurement(measurement, zoneId)).toList())
        .baseline(history.baseline().map(measurement -> toMeasurement(measurement, zoneId)).orElse(null))
        .build();
  }

  private WeightMeasurement toMeasurement(Weight measurement, ZoneId zoneId) {
    return WeightMeasurement.builder()
        .date(measurement.getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
        .weight(measurement.getWeight())
        .fatRatio(measurement.getFatRatio())
        .fatMassWeight(measurement.getFatMassWeight())
        .build();
  }
}
