package mucsi96.traininglog.ftp;

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
import mucsi96.traininglog.weight.Weight;
import mucsi96.traininglog.weight.WeightRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class FtpService {
  private static final int MIN_RIDE_SECONDS = 1200;
  private static final double DURATION_EXPONENT = 0.07;
  private static final float COMPARISON_EPSILON = 1e-3f;

  private final RideRepository rideRepository;
  private final WeightRepository weightRepository;
  private final FtpRepository ftpRepository;
  private final EntityManager entityManager;
  private final Clock clock;

  @Transactional
  public boolean recompute(ZoneId zoneId) {
    List<Ride> rides = rideRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
    List<Weight> weights = weightRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
    Map<ZonedDateTime, Computed> intended = computeMeasurements(rides, weights, zoneId);
    Map<ZonedDateTime, Ftp> persisted = ftpRepository.findAll().stream()
        .collect(Collectors.toMap(Ftp::getCreatedAt, row -> row));
    ZonedDateTime pulledAt = ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC);
    boolean changed = false;

    for (Ftp row : persisted.values()) {
      if (!intended.containsKey(row.getCreatedAt())) {
        ftpRepository.delete(row);
        changed = true;
      }
    }

    for (Map.Entry<ZonedDateTime, Computed> entry : intended.entrySet()) {
      ZonedDateTime date = entry.getKey();
      Computed computed = entry.getValue();
      Ftp row = persisted.get(date);
      if (row == null) {
        entityManager.persist(Ftp.builder()
            .createdAt(date)
            .pulledAt(pulledAt)
            .ftp(computed.ftp())
            .weight(computed.weight())
            .ftpPerKg(computed.ftpPerKg())
            .build());
        changed = true;
      } else if (differs(row.getFtp(), computed.ftp())
          || differs(row.getWeight(), computed.weight())
          || differs(row.getFtpPerKg(), computed.ftpPerKg())) {
        row.setFtp(computed.ftp());
        row.setWeight(computed.weight());
        row.setFtpPerKg(computed.ftpPerKg());
        row.setPulledAt(pulledAt);
        changed = true;
      }
    }

    log.info(changed ? "FTP recompute applied changes" : "FTP recompute matched persisted values");
    return changed;
  }

  public List<Ftp> getFtp(Optional<Integer> period, ZoneId zoneId) {
    ZonedDateTime endTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS).plusDays(1);
    return period.map(days -> {
      ZonedDateTime startTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS).minusDays(days - 1);
      return ftpRepository.findByCreatedAtBetween(startTime, endTime, Sort.by(Sort.Direction.ASC, "createdAt"));
    }).orElseGet(() -> ftpRepository.findByCreatedAtBefore(endTime, Sort.by(Sort.Direction.ASC, "createdAt")));
  }

  private Map<ZonedDateTime, Computed> computeMeasurements(List<Ride> rides, List<Weight> weights, ZoneId zoneId) {
    TreeMap<LocalDate, Double> rideEftpByDay = rides.stream()
        .filter(ride -> ride.getMovingTime() >= MIN_RIDE_SECONDS)
        .filter(ride -> ride.getWeightedAverageWatts() > 0)
        .collect(Collectors.groupingBy(
            ride -> ride.getCreatedAt().withZoneSameInstant(zoneId).toLocalDate(),
            TreeMap::new,
            Collectors.collectingAndThen(
                Collectors.toList(),
                dayRides -> dayRides.stream()
                    .mapToDouble(FtpService::rideEftp)
                    .max()
                    .orElse(0.0))));

    TreeMap<LocalDate, Double> weightByDay = weights.stream()
        .collect(Collectors.groupingBy(
            weight -> weight.getCreatedAt().withZoneSameInstant(zoneId).toLocalDate(),
            TreeMap::new,
            Collectors.collectingAndThen(
                Collectors.maxBy((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt())),
                latest -> latest.map(w -> (double) w.getWeight()).orElse(0.0))));

    Map<ZonedDateTime, Computed> result = new LinkedHashMap<>();
    for (Map.Entry<LocalDate, Double> entry : rideEftpByDay.entrySet()) {
      LocalDate day = entry.getKey();
      double eftp = entry.getValue();
      Map.Entry<LocalDate, Double> weightEntry = weightByDay.floorEntry(day);
      if (eftp > 0 && weightEntry != null && weightEntry.getValue() > 0) {
        ZonedDateTime dayStart = day.atStartOfDay(zoneId).withZoneSameInstant(ZoneOffset.UTC);
        double weight = weightEntry.getValue();
        result.put(dayStart, new Computed((float) eftp, (float) weight, (float) (eftp / weight)));
      }
    }
    return result;
  }

  // Riegel power-duration model inverted to solve for FTP: assuming the ride
  // was a maximal effort, the max power sustainable for duration t is
  //   P(t) = FTP * (1h / t)^DURATION_EXPONENT
  // so the FTP that would explain a ride with Normalized Power NP held for
  // duration t is
  //   FTP = NP * (t / 1h)^DURATION_EXPONENT.
  // The exponent is positive on purpose: a long ride held at a given NP
  // implies a higher FTP than a short ride at the same NP, because sustaining
  // power gets harder with duration. Non-maximal rides therefore yield a
  // lower-bound FTP estimate, which is the intended interpretation.
  private static double rideEftp(Ride ride) {
    double durationHours = ride.getMovingTime() / 3600.0;
    return ride.getWeightedAverageWatts() * Math.pow(durationHours, DURATION_EXPONENT);
  }

  private static boolean differs(float persisted, float computed) {
    return Math.abs(persisted - computed) >= COMPARISON_EPSILON;
  }

  private record Computed(float ftp, float weight, float ftpPerKg) {
  }
}
