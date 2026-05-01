package mucsi96.traininglog.fitness;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
  private final Clock clock;

  @Transactional
  public boolean recomputeIfNeeded(ZoneId zoneId) {
    Optional<Fitness> latest = fitnessRepository.findFirstByOrderByPulledAtDesc();
    List<Ride> rides = rideRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));

    if (!shouldRecompute(latest, rides, zoneId)) {
      log.info("Skipping fitness recompute; already pulled today and no new activities since");
      return false;
    }

    ZonedDateTime pulledAt = ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC);
    recompute(rides, zoneId, pulledAt);
    return true;
  }

  public List<Fitness> getFitness(Optional<Integer> period, ZoneId zoneId) {
    ZonedDateTime endTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS).plusDays(1);
    return period.map(days -> {
      ZonedDateTime startTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS).minusDays(days - 1);
      return fitnessRepository.findByCreatedAtBetween(startTime, endTime, Sort.by(Sort.Direction.ASC, "createdAt"));
    }).orElseGet(() -> fitnessRepository.findByCreatedAtBefore(endTime, Sort.by(Sort.Direction.ASC, "createdAt")));
  }

  private boolean shouldRecompute(Optional<Fitness> latest, List<Ride> rides, ZoneId zoneId) {
    if (latest.isEmpty()) {
      log.info("No fitness computed yet; triggering first recompute");
      return true;
    }
    ZonedDateTime lastPullAt = latest.get().getPulledAt();
    if (lastPullAt == null) {
      return true;
    }
    ZonedDateTime startOfToday = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS);
    if (lastPullAt.isBefore(startOfToday)) {
      log.info("Last fitness pull was before today; triggering first-of-day recompute");
      return true;
    }
    boolean hasNewActivity = rides.stream().anyMatch(ride -> ride.getCreatedAt().isAfter(lastPullAt));
    if (hasNewActivity) {
      log.info("New activity detected since last fitness pull; triggering recompute");
    }
    return hasNewActivity;
  }

  private void recompute(List<Ride> rides, ZoneId zoneId, ZonedDateTime pulledAt) {
    Map<LocalDate, Double> loadByDay = rides.stream()
        .filter(ride -> ride.getSufferScore() != null)
        .collect(Collectors.groupingBy(
            ride -> ride.getCreatedAt().withZoneSameInstant(zoneId).toLocalDate(),
            TreeMap::new,
            Collectors.summingDouble(ride -> ride.getSufferScore().doubleValue())));

    fitnessRepository.deleteAllInBatch();

    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    LocalDate cursor = loadByDay.isEmpty() ? today : loadByDay.keySet().iterator().next();
    LocalDate end = today.isAfter(cursor) ? today : cursor;

    double fitness = 0;
    double fatigue = 0;
    List<Fitness> series = new ArrayList<>();
    while (!cursor.isAfter(end)) {
      double load = loadByDay.getOrDefault(cursor, 0.0);
      fitness = LAMBDA_FITNESS * fitness + (1 - LAMBDA_FITNESS) * load;
      fatigue = LAMBDA_FATIGUE * fatigue + (1 - LAMBDA_FATIGUE) * load;
      series.add(Fitness.builder()
          .createdAt(cursor.atStartOfDay(zoneId).withZoneSameInstant(ZoneOffset.UTC))
          .pulledAt(pulledAt)
          .fitness((float) fitness)
          .fatigue((float) fatigue)
          .form((float) (fitness - fatigue))
          .build());
      cursor = cursor.plusDays(1);
    }

    fitnessRepository.saveAll(series);
  }
}
