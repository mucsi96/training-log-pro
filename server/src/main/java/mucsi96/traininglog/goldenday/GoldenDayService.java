package mucsi96.traininglog.goldenday;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.GoldenDayStats;
import mucsi96.traininglog.pushups.PushupSet;
import mucsi96.traininglog.pushups.PushupSetRepository;
import mucsi96.traininglog.reading.ReadingService;
import mucsi96.traininglog.rides.Ride;
import mucsi96.traininglog.rides.RideRepository;
import mucsi96.traininglog.settings.SettingsEntity;
import mucsi96.traininglog.settings.SettingsService;
import mucsi96.traininglog.tasks.DailyTaskService;

@Service
@RequiredArgsConstructor
public class GoldenDayService {

  private final PushupSetRepository pushupSetRepository;
  private final RideRepository rideRepository;
  private final GoldenDayRepository goldenDayRepository;
  private final SettingsService settingsService;
  private final ReadingService readingService;
  private final DailyTaskService dailyTaskService;
  private final Clock clock;

  @Transactional
  public GoldenDayStats getStats(ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    SettingsEntity goal = settingsService.getCurrent();

    Map<LocalDate, Integer> pushupsByDay = pushupSetRepository
        .findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream()
        .collect(Collectors.groupingBy(
            (PushupSet set) -> set.getCreatedAt().withZoneSameInstant(zoneId).toLocalDate(),
            TreeMap::new,
            Collectors.summingInt(PushupSet::getCount)));

    Map<LocalDate, Double> elevationByDay = rideRepository
        .findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream()
        .collect(Collectors.groupingBy(
            (Ride ride) -> ride.getCreatedAt().withZoneSameInstant(zoneId).toLocalDate(),
            TreeMap::new,
            Collectors.summingDouble(ride -> (double) ride.getTotalElevationGain())));

    Map<LocalDate, Integer> readingPagesByDay = readingService.getPagesReadByDay(zoneId);

    Map<LocalDate, Integer> taskCompletionsCountByDay = dailyTaskService.getCompletionsByDay()
        .entrySet().stream()
        .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().size(), (a, b) -> a, TreeMap::new));
    int totalTasks = dailyTaskService.listTasks().size();

    Map<LocalDate, GoldenDayEntity> persisted = goldenDayRepository.findAll().stream()
        .collect(Collectors.toMap(GoldenDayEntity::getDate, e -> e));

    Set<LocalDate> candidates = new TreeSet<>(pushupsByDay.keySet());
    candidates.addAll(readingPagesByDay.keySet());
    candidates.addAll(taskCompletionsCountByDay.keySet());
    candidates.add(today);
    for (LocalDate day : candidates) {
      if (persisted.containsKey(day)) {
        continue;
      }
      int pushups = pushupsByDay.getOrDefault(day, 0);
      double elevation = elevationByDay.getOrDefault(day, 0d);
      int readingPages = readingPagesByDay.getOrDefault(day, 0);
      int tasksCompleted = taskCompletionsCountByDay.getOrDefault(day, 0);
      if (pushups >= goal.getPushupGoal()
          && elevation >= goal.getElevationGoal()
          && (goal.getReadingPagesGoal() == 0 || readingPages >= goal.getReadingPagesGoal())
          && (goal.getDailyTaskGoal() == 0 || tasksCompleted >= goal.getDailyTaskGoal())) {
        GoldenDayEntity saved = goldenDayRepository.save(GoldenDayEntity.builder().date(day).build());
        persisted.put(day, saved);
      }
    }

    Set<LocalDate> goldenDates = new TreeSet<>(persisted.keySet());
    YearMonth currentMonth = YearMonth.from(today);
    int monthCount = (int) goldenDates.stream()
        .filter(date -> YearMonth.from(date).equals(currentMonth))
        .count();

    GoldenDayEntity todayEntity = persisted.get(today);
    boolean celebrateToday = todayEntity != null && todayEntity.getCelebratedAt() == null;

    return GoldenDayStats.builder()
        .monthCount(monthCount)
        .currentStreak(computeStreak(goldenDates, today))
        .todayGolden(goldenDates.contains(today))
        .celebrateToday(celebrateToday)
        .todayPushups(pushupsByDay.getOrDefault(today, 0))
        .todayElevationGain(elevationByDay.getOrDefault(today, 0d))
        .todayReadingPages(readingPagesByDay.getOrDefault(today, 0))
        .pushupGoal(goal.getPushupGoal())
        .elevationGoal(goal.getElevationGoal())
        .readingPagesGoal(goal.getReadingPagesGoal())
        .todayTasksCompleted(taskCompletionsCountByDay.getOrDefault(today, 0))
        .todayTasksTotal(totalTasks)
        .dailyTaskGoal(goal.getDailyTaskGoal())
        .goldenDates(goldenDates.stream().sorted().toList())
        .build();
  }

  @Transactional
  public void markTodayCelebrated(ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    goldenDayRepository.findById(today).ifPresent(entity -> {
      if (entity.getCelebratedAt() == null) {
        entity.setCelebratedAt(ZonedDateTime.now(clock));
        goldenDayRepository.save(entity);
      }
    });
  }

  private int computeStreak(Set<LocalDate> goldenDates, LocalDate today) {
    LocalDate cursor = goldenDates.contains(today) ? today : today.minusDays(1);
    if (!goldenDates.contains(cursor)) {
      return 0;
    }
    int streak = 0;
    while (goldenDates.contains(cursor)) {
      streak++;
      cursor = cursor.minusDays(1);
    }
    return streak;
  }
}
