package mucsi96.traininglog.fitness;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.Fitness;
import mucsi96.traininglog.rides.Ride;
import mucsi96.traininglog.rides.RideRepository;

@Service
@RequiredArgsConstructor
public class FitnessService {
  private static final double LAMBDA_FITNESS = Math.exp(-1.0 / 42.0);
  private static final double LAMBDA_FATIGUE = Math.exp(-1.0 / 7.0);

  private final RideRepository rideRepository;
  private final Clock clock;

  public Fitness getFitness(ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    List<Ride> rides = rideRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));

    Map<LocalDate, Double> loadByDay = rides.stream()
        .filter(ride -> ride.getSufferScore() != null)
        .collect(Collectors.groupingBy(
            ride -> ride.getCreatedAt().withZoneSameInstant(zoneId).toLocalDate(),
            TreeMap::new,
            Collectors.summingDouble(ride -> ride.getSufferScore().doubleValue())));

    double fitness = 0;
    double fatigue = 0;

    if (!loadByDay.isEmpty()) {
      LocalDate cursor = loadByDay.keySet().iterator().next();
      LocalDate end = today.isAfter(cursor) ? today : cursor;
      while (!cursor.isAfter(end)) {
        double load = loadByDay.getOrDefault(cursor, 0.0);
        fitness = LAMBDA_FITNESS * fitness + (1 - LAMBDA_FITNESS) * load;
        fatigue = LAMBDA_FATIGUE * fatigue + (1 - LAMBDA_FATIGUE) * load;
        cursor = cursor.plusDays(1);
      }
    }

    return Fitness.builder()
        .fitness(fitness)
        .fatigue(fatigue)
        .form(fitness - fatigue)
        .build();
  }
}
