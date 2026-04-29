package mucsi96.traininglog.segments;

import java.time.Clock;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.PodiumMessage;
import mucsi96.traininglog.api.PodiumMessage.PeriodEnum;

@Service
@RequiredArgsConstructor
public class PodiumService {
  private static final int PODIUM_SIZE = 3;

  private final SegmentEffortRepository segmentEffortRepository;
  private final Clock clock;

  public Optional<PodiumMessage> getTodayPodium(ZoneId zoneId) {
    ZonedDateTime startOfToday = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS);
    ZonedDateTime endOfToday = startOfToday.plusDays(1);

    List<SegmentEffort> todayEfforts = segmentEffortRepository
        .findByStartDateBetween(startOfToday, endOfToday, Sort.by(Sort.Direction.ASC, "startDate"));

    return todayEfforts.stream()
        .flatMap(effort -> evaluatePodiumPlacements(effort, zoneId).stream())
        .max(Comparator.comparingDouble(this::score))
        .map(this::toMessage);
  }

  private List<PodiumPlacement> evaluatePodiumPlacements(SegmentEffort effort, ZoneId zoneId) {
    ZonedDateTime startOfWeek = ZonedDateTime.now(clock).withZoneSameInstant(zoneId)
        .truncatedTo(ChronoUnit.DAYS).minusDays(6);
    ZonedDateTime startOfMonth = ZonedDateTime.now(clock).withZoneSameInstant(zoneId)
        .truncatedTo(ChronoUnit.DAYS).minusDays(29);

    List<SegmentEffort> allTime = segmentEffortRepository
        .findBySegmentId(effort.getSegmentId(), Sort.by(Sort.Direction.ASC, "elapsedTime"));
    List<SegmentEffort> month = segmentEffortRepository
        .findBySegmentIdAndStartDateGreaterThanEqual(effort.getSegmentId(), startOfMonth,
            Sort.by(Sort.Direction.ASC, "elapsedTime"));
    List<SegmentEffort> week = segmentEffortRepository
        .findBySegmentIdAndStartDateGreaterThanEqual(effort.getSegmentId(), startOfWeek,
            Sort.by(Sort.Direction.ASC, "elapsedTime"));

    return List.of(PeriodEnum.WEEK, PeriodEnum.MONTH, PeriodEnum.ALL_TIME).stream()
        .map(period -> placementFor(effort, period, switch (period) {
          case WEEK -> week;
          case MONTH -> month;
          case ALL_TIME -> allTime;
        }))
        .flatMap(Optional::stream)
        .toList();
  }

  private Optional<PodiumPlacement> placementFor(SegmentEffort effort, PeriodEnum period,
      List<SegmentEffort> rankedEfforts) {
    if (rankedEfforts.size() < PODIUM_SIZE) {
      return Optional.empty();
    }
    int position = 1;
    for (SegmentEffort ranked : rankedEfforts) {
      if (ranked.getId() == effort.getId()) {
        if (position <= PODIUM_SIZE) {
          return Optional.of(new PodiumPlacement(effort, period, position));
        }
        return Optional.empty();
      }
      position++;
    }
    return Optional.empty();
  }

  private double score(PodiumPlacement placement) {
    double positionScore = PODIUM_SIZE + 1 - placement.position();
    double periodScore = switch (placement.period()) {
      case ALL_TIME -> 3;
      case MONTH -> 2;
      case WEEK -> 1;
    };
    double difficulty = Math.max(placement.effort().getSegmentDistance(), 1)
        * Math.max(placement.effort().getSegmentAverageGrade(), 0.1);
    return positionScore * periodScore * difficulty;
  }

  private PodiumMessage toMessage(PodiumPlacement placement) {
    String periodLabel = switch (placement.period()) {
      case ALL_TIME -> "all-time";
      case MONTH -> "this month";
      case WEEK -> "this week";
    };
    String podiumLabel = switch (placement.position()) {
      case 1 -> "1st place";
      case 2 -> "2nd place";
      case 3 -> "3rd place";
      default -> placement.position() + "th place";
    };
    String message = String.format("%s %s on %s",
        podiumLabel, periodLabel, placement.effort().getSegmentName());
    return PodiumMessage.builder()
        .segmentName(placement.effort().getSegmentName())
        .period(placement.period())
        .position(placement.position())
        .message(message)
        .build();
  }

  private record PodiumPlacement(SegmentEffort effort, PeriodEnum period, int position) {
  }
}
