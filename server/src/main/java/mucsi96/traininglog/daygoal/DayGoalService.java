package mucsi96.traininglog.daygoal;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.DayGoalMetric;
import mucsi96.traininglog.api.DayGoalStats;
import mucsi96.traininglog.api.DayGoalTier;
import mucsi96.traininglog.api.MetricValue;
import mucsi96.traininglog.api.TierCount;
import mucsi96.traininglog.pushups.PushupSet;
import mucsi96.traininglog.pushups.PushupSetRepository;
import mucsi96.traininglog.reading.ReadingService;
import mucsi96.traininglog.rides.Ride;
import mucsi96.traininglog.rides.RideRepository;
import mucsi96.traininglog.tasks.DailyTaskService;

@Service
@RequiredArgsConstructor
public class DayGoalService {

  private final PushupSetRepository pushupSetRepository;
  private final RideRepository rideRepository;
  private final ReadingService readingService;
  private final DailyTaskService dailyTaskService;
  private final DayGoalRequirementService requirementService;
  private final AchievedDayRepository achievedDayRepository;
  private final Clock clock;

  /**
   * Awards every day the most demanding tier it has reached under the current
   * requirements, upgrading days that already hold a lower tier, and reports
   * today's standing. Awarded tiers are never taken away.
   */
  @Transactional
  public DayGoalStats getStats(ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    Map<DayGoalTier, Map<DayGoalMetric, Integer>> requirements = requirementService.getRequirements();
    Map<DayGoalMetric, Map<LocalDate, ? extends Number>> values = valuesByMetric(zoneId);

    Set<LocalDate> candidates = Stream
        .concat(Stream.of(today), values.values().stream().flatMap(byDay -> byDay.keySet().stream()))
        .collect(Collectors.toCollection(TreeSet::new));
    Map<LocalDate, AchievedDayEntity> before = achievedDayRepository.findAll().stream()
        .collect(Collectors.toMap(AchievedDayEntity::getDate, Function.identity()));

    ZonedDateTime now = ZonedDateTime.now(clock);
    List<AchievedDayEntity> upgrades = candidates.stream()
        .flatMap(day -> achievedTier(requirements, values, day)
            .filter(tier -> Optional.ofNullable(before.get(day))
                .map(held -> outranks(tier, held.getTier()))
                .orElse(true))
            .map(tier -> AchievedDayEntity.builder().date(day).tier(tier).achievedAt(now).build())
            .stream())
        .toList();
    achievedDayRepository.saveAll(upgrades);

    Map<LocalDate, AchievedDayEntity> achieved = Stream.concat(before.values().stream(), upgrades.stream())
        .collect(Collectors.toMap(AchievedDayEntity::getDate, Function.identity(), (held, upgrade) -> upgrade,
            TreeMap::new));

    YearMonth month = YearMonth.from(today);
    Map<DayGoalTier, Long> monthCounts = achieved.values().stream()
        .filter(day -> YearMonth.from(day.getDate()).equals(month))
        .collect(Collectors.groupingBy(AchievedDayEntity::getTier, Collectors.counting()));
    AchievedDayEntity todayAchieved = achieved.get(today);
    Optional<DayGoalTier> todayTier = Optional.ofNullable(todayAchieved).map(AchievedDayEntity::getTier);

    return DayGoalStats.builder()
        .todayTier(todayTier.orElse(null))
        .nextTier(nextTier(requirements, todayTier).orElse(null))
        .celebrateToday(todayAchieved != null && todayAchieved.getCelebratedAt() == null)
        .currentStreak(streak(achieved.keySet(), today))
        .monthCounts(Stream.of(DayGoalTier.values())
            .map(tier -> TierCount.builder()
                .tier(tier)
                .count(monthCounts.getOrDefault(tier, 0L).intValue())
                .build())
            .toList())
        .todayProgress(Stream.of(DayGoalMetric.values())
            .map(metric -> MetricValue.builder()
                .metric(metric)
                .value(valueOf(values, metric, today))
                .build())
            .toList())
        .tiers(DayGoalRequirementService.toTierGoals(requirements))
        .build();
  }

  @Transactional
  public void markTodayCelebrated(ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    achievedDayRepository.findById(today)
        .filter(day -> day.getCelebratedAt() == null)
        .ifPresent(day -> {
          day.setCelebratedAt(ZonedDateTime.now(clock));
          achievedDayRepository.save(day);
        });
  }

  private Map<DayGoalMetric, Map<LocalDate, ? extends Number>> valuesByMetric(ZoneId zoneId) {
    return Map.of(
        DayGoalMetric.PUSHUPS,
        totalByDay(pushupSetRepository.findAll(), PushupSet::getCreatedAt, PushupSet::getCount, zoneId),
        DayGoalMetric.ELEVATION,
        totalByDay(rideRepository.findAll(), Ride::getCreatedAt, Ride::getTotalElevationGain, zoneId),
        DayGoalMetric.READING_PAGES, readingService.getPagesReadByDay(zoneId),
        DayGoalMetric.DAILY_TASKS, dailyTaskService.getCompletionCountByDay());
  }

  private static <T> Map<LocalDate, Double> totalByDay(Collection<T> items, Function<T, ZonedDateTime> at,
      ToDoubleFunction<T> amount, ZoneId zoneId) {
    return items.stream()
        .collect(Collectors.groupingBy(
            item -> at.apply(item).withZoneSameInstant(zoneId).toLocalDate(),
            TreeMap::new,
            Collectors.summingDouble(amount)));
  }

  private static double valueOf(Map<DayGoalMetric, Map<LocalDate, ? extends Number>> values, DayGoalMetric metric,
      LocalDate day) {
    return Optional.ofNullable(values.get(metric).get(day)).map(Number::doubleValue).orElse(0d);
  }

  /** The most demanding tier whose every required metric the day has reached. */
  private static Optional<DayGoalTier> achievedTier(Map<DayGoalTier, Map<DayGoalMetric, Integer>> requirements,
      Map<DayGoalMetric, Map<LocalDate, ? extends Number>> values, LocalDate day) {
    return requirements.entrySet().stream()
        .filter(tier -> !tier.getValue().isEmpty())
        .filter(tier -> tier.getValue().entrySet().stream()
            .allMatch(requirement -> valueOf(values, requirement.getKey(), day) >= requirement.getValue()))
        .map(Map.Entry::getKey)
        .findFirst();
  }

  /** The least demanding attainable tier above the one reached, if there is any. */
  private static Optional<DayGoalTier> nextTier(Map<DayGoalTier, Map<DayGoalMetric, Integer>> requirements,
      Optional<DayGoalTier> reached) {
    return requirements.entrySet().stream()
        .filter(tier -> !tier.getValue().isEmpty())
        .map(Map.Entry::getKey)
        .filter(tier -> reached.map(held -> outranks(tier, held)).orElse(true))
        .reduce((moreDemanding, lessDemanding) -> lessDemanding);
  }

  /** Tiers are declared from the most to the least demanding. */
  private static boolean outranks(DayGoalTier tier, DayGoalTier other) {
    return tier.compareTo(other) < 0;
  }

  private static int streak(Set<LocalDate> achievedDates, LocalDate today) {
    LocalDate start = achievedDates.contains(today) ? today : today.minusDays(1);
    return (int) Stream.iterate(start, achievedDates::contains, date -> date.minusDays(1)).count();
  }
}
