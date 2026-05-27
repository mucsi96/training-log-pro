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
import mucsi96.traininglog.strava.StravaConfiguration;
import mucsi96.traininglog.weight.Weight;
import mucsi96.traininglog.weight.WeightRepository;

@Service
@RequiredArgsConstructor
public class PodiumService {
  private static final int PODIUM_SIZE = 3;

  private final SegmentEffortRepository segmentEffortRepository;
  private final SegmentRepository segmentRepository;
  private final WeightRepository weightRepository;
  private final StravaConfiguration stravaConfiguration;
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
          return Optional.of(new PodiumPlacement(effort, period, position, rankedEfforts));
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
    SegmentEffort effort = placement.effort();
    String message = String.format("%s %s on %s",
        podiumLabel, periodLabel, effort.getSegmentName());

    int position = placement.position();
    List<SegmentEffort> ranked = placement.rankedEfforts();
    SegmentEffort faster = position >= 2 ? ranked.get(position - 2) : null;
    SegmentEffort slower = ranked.size() > position ? ranked.get(position) : null;

    float elevationGain = effort.getSegmentDistance() * effort.getSegmentAverageGrade() / 100f;
    Float averageWattsPerKg = wattsPerKg(effort);

    String segmentUrl = stravaConfiguration.getApiUri() + "/segments/" + effort.getSegmentId();

    PodiumMessage.PodiumMessageBuilder builder = PodiumMessage.builder()
        .segmentName(effort.getSegmentName())
        .segmentUrl(segmentUrl)
        .period(placement.period())
        .position(position)
        .message(message)
        .distance(effort.getSegmentDistance())
        .elapsedTime(effort.getElapsedTime())
        .averageGrade(effort.getSegmentAverageGrade())
        .elevationGain(elevationGain)
        .averageWatts(effort.getAverageWatts())
        .averageWattsPerKg(averageWattsPerKg)
        .fasterPosition(faster != null ? position - 1 : null)
        .gapToFaster(faster != null ? effort.getElapsedTime() - faster.getElapsedTime() : null)
        .slowerPosition(slower != null ? position + 1 : null)
        .gapToSlower(slower != null ? slower.getElapsedTime() - effort.getElapsedTime() : null);

    segmentRepository.findById(effort.getSegmentId()).ifPresent(segment -> builder
        .latitudes(segment.getLatitudes())
        .longitudes(segment.getLongitudes())
        .distances(segment.getDistances())
        .altitudes(segment.getAltitudes()));

    return builder.build();
  }

  private Float wattsPerKg(SegmentEffort effort) {
    if (effort.getAverageWatts() == null) {
      return null;
    }
    return weightRepository
        .findFirstByCreatedAtBeforeOrderByCreatedAtDesc(effort.getStartDate().plusDays(1))
        .map(Weight::getWeight)
        .filter(weight -> weight > 0)
        .map(weight -> effort.getAverageWatts() / weight)
        .orElse(null);
  }

  private record PodiumPlacement(SegmentEffort effort, PeriodEnum period, int position,
      List<SegmentEffort> rankedEfforts) {
  }
}
