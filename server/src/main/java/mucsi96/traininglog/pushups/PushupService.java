package mucsi96.traininglog.pushups;

import java.time.Clock;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class PushupService {
  private final PushupSetRepository pushupSetRepository;
  private final Clock clock;

  public PushupSet addSet(int count) {
    PushupSet set = PushupSet.builder()
        .createdAt(ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS))
        .count(count)
        .build();
    log.info("persisting pushup set with count {}", count);
    return pushupSetRepository.save(set);
  }

  public void deleteSet(ZonedDateTime createdAt) {
    log.info("deleting pushup set at {}", createdAt);
    pushupSetRepository.deleteById(createdAt);
  }

  public List<PushupSet> getSets(Optional<Integer> period, ZoneId zoneId) {
    ZonedDateTime endTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS)
        .plusDays(1);
    return period.map(days -> {
      ZonedDateTime startTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS)
          .minusDays(days - 1L);
      return pushupSetRepository.findByCreatedAtBetween(startTime, endTime,
          Sort.by(Sort.Direction.ASC, "createdAt"));
    }).orElseGet(() -> pushupSetRepository.findByCreatedAtBefore(endTime,
        Sort.by(Sort.Direction.ASC, "createdAt")));
  }
}
