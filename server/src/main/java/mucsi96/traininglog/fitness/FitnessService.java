package mucsi96.traininglog.fitness;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.rides.Ride;
import mucsi96.traininglog.rides.RideRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class FitnessService {
  private static final double LAMBDA_FITNESS = Math.exp(-1.0 / 42.0);
  private static final double LAMBDA_FATIGUE = Math.exp(-1.0 / 7.0);

  private final RideRepository rideRepository;
  private final FitnessRepository fitnessRepository;
  private final EntityManager entityManager;
  private final Clock clock;

  @Transactional
  public boolean recompute(ZoneId zoneId) {
    List<Ride> rides = rideRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
    Map<ZonedDateTime, Computed> intended = computeMeasurements(rides, zoneId);
    Map<ZonedDateTime, Fitness> persisted = fitnessRepository.findAll().stream()
        .collect(Collectors.toMap(Fitness::getCreatedAt, row -> row));
    ZonedDateTime pulledAt = ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC);
    boolean changed = false;

    for (Fitness row : persisted.values()) {
      if (!intended.containsKey(row.getCreatedAt())) {
        fitnessRepository.delete(row);
        changed = true;
      }
    }

    for (Map.Entry<ZonedDateTime, Computed> entry : intended.entrySet()) {
      ZonedDateTime date = entry.getKey();
      Computed computed = entry.getValue();
      Fitness row = persisted.get(date);
      if (row == null) {
        entityManager.persist(Fitness.builder()
            .createdAt(date)
            .pulledAt(pulledAt)
            .fitness(computed.fitness())
            .fatigue(computed.fatigue())
            .form(computed.form())
            .build());
        changed = true;
      } else if (row.getFitness() != computed.fitness()
          || row.getFatigue() != computed.fatigue()
          || row.getForm() != computed.form()) {
        row.setFitness(computed.fitness());
        row.setFatigue(computed.fatigue());
        row.setForm(computed.form());
        row.setPulledAt(pulledAt);
        changed = true;
      }
    }

    log.info(changed ? "Fitness recompute applied changes" : "Fitness recompute matched persisted values");
    return changed;
  }

  public List<Fitness> getFitness(Optional<Integer> period, ZoneId zoneId) {
    ZonedDateTime endTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS).plusDays(1);
    return period.map(days -> {
      ZonedDateTime startTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS).minusDays(days - 1);
      return fitnessRepository.findByCreatedAtBetween(startTime, endTime, Sort.by(Sort.Direction.ASC, "createdAt"));
    }).orElseGet(() -> fitnessRepository.findByCreatedAtBefore(endTime, Sort.by(Sort.Direction.ASC, "createdAt")));
  }

  private Map<ZonedDateTime, Computed> computeMeasurements(List<Ride> rides, ZoneId zoneId) {
    Map<LocalDate, Double> loadByDay = rides.stream()
        .filter(ride -> ride.getSufferScore() != null)
        .collect(Collectors.groupingBy(
            ride -> ride.getCreatedAt().withZoneSameInstant(zoneId).toLocalDate(),
            TreeMap::new,
            Collectors.summingDouble(ride -> ride.getSufferScore().doubleValue())));

    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    LocalDate cursor = loadByDay.isEmpty() ? today : loadByDay.keySet().iterator().next();
    LocalDate end = today.isAfter(cursor) ? today : cursor;

    Map<ZonedDateTime, Computed> result = new LinkedHashMap<>();
    double fitness = 0;
    double fatigue = 0;
    while (!cursor.isAfter(end)) {
      double load = loadByDay.getOrDefault(cursor, 0.0);
      fitness = LAMBDA_FITNESS * fitness + (1 - LAMBDA_FITNESS) * load;
      fatigue = LAMBDA_FATIGUE * fatigue + (1 - LAMBDA_FATIGUE) * load;
      ZonedDateTime dayStart = cursor.atStartOfDay(zoneId).withZoneSameInstant(ZoneOffset.UTC);
      result.put(dayStart, new Computed((float) fitness, (float) fatigue, (float) (fitness - fatigue)));
      cursor = cursor.plusDays(1);
    }
    return result;
  }

  private record Computed(float fitness, float fatigue, float form) {
  }
}
