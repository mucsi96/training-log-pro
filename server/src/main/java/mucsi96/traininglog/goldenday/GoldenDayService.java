package mucsi96.traininglog.goldenday;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.HashSet;
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
import mucsi96.traininglog.rides.Ride;
import mucsi96.traininglog.rides.RideRepository;
import mucsi96.traininglog.settings.GoldenDayGoalEntity;
import mucsi96.traininglog.settings.GoldenDayGoalService;

@Service
@RequiredArgsConstructor
public class GoldenDayService {

  private final PushupSetRepository pushupSetRepository;
  private final RideRepository rideRepository;
  private final GoldenDayRepository goldenDayRepository;
  private final GoldenDayGoalService goldenDayGoalService;
  private final Clock clock;

  @Transactional
  public GoldenDayStats getStats() {
    LocalDate today = LocalDate.now(clock.withZone(ZoneOffset.UTC));
    GoldenDayGoalEntity goal = goldenDayGoalService.getCurrent();

    Map<LocalDate, Integer> pushupsByDay = pushupSetRepository
        .findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream()
        .collect(Collectors.groupingBy(
            (PushupSet set) -> set.getCreatedAt().withZoneSameInstant(ZoneOffset.UTC).toLocalDate(),
            TreeMap::new,
            Collectors.summingInt(PushupSet::getCount)));

    Map<LocalDate, Double> elevationByDay = rideRepository
        .findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream()
        .collect(Collectors.groupingBy(
            (Ride ride) -> ride.getCreatedAt().withZoneSameInstant(ZoneOffset.UTC).toLocalDate(),
            TreeMap::new,
            Collectors.summingDouble(ride -> (double) ride.getTotalElevationGain())));

    Set<LocalDate> persisted = goldenDayRepository.findAll().stream()
        .map(GoldenDayEntity::getDate)
        .collect(Collectors.toCollection(HashSet::new));

    Set<LocalDate> candidates = new TreeSet<>(pushupsByDay.keySet());
    candidates.add(today);
    for (LocalDate day : candidates) {
      if (persisted.contains(day)) {
        continue;
      }
      int pushups = pushupsByDay.getOrDefault(day, 0);
      double elevation = elevationByDay.getOrDefault(day, 0d);
      if (pushups >= goal.getPushupGoal() && elevation >= goal.getElevationGoal()) {
        goldenDayRepository.save(GoldenDayEntity.builder().date(day).build());
        persisted.add(day);
      }
    }

    Set<LocalDate> goldenDates = new TreeSet<>(persisted);
    YearMonth currentMonth = YearMonth.from(today);
    int monthCount = (int) goldenDates.stream()
        .filter(date -> YearMonth.from(date).equals(currentMonth))
        .count();

    return GoldenDayStats.builder()
        .monthCount(monthCount)
        .currentStreak(computeStreak(goldenDates, today))
        .todayGolden(goldenDates.contains(today))
        .todayPushups(pushupsByDay.getOrDefault(today, 0))
        .todayElevationGain(elevationByDay.getOrDefault(today, 0d))
        .pushupGoal(goal.getPushupGoal())
        .elevationGoal(goal.getElevationGoal())
        .goldenDates(goldenDates.stream().sorted().toList())
        .build();
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
