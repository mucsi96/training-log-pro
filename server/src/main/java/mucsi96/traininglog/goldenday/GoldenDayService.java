package mucsi96.traininglog.goldenday;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

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
  private final GoldenDayGoalService goldenDayGoalService;
  private final Clock clock;

  public GoldenDayStats getStats(ZoneId zoneId) {
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

    List<GoldenDayGoalEntity> goalsAsc = goldenDayGoalService.getAllOrderedAsc();

    Set<LocalDate> goldenDates = pushupsByDay.keySet().stream()
        .filter(date -> {
          GoldenDayGoalEntity goal = goldenDayGoalService.getEffectiveOn(date, goalsAsc);
          return pushupsByDay.getOrDefault(date, 0) >= goal.getPushupGoal()
              && elevationByDay.getOrDefault(date, 0d) >= goal.getElevationGoal();
        })
        .collect(Collectors.toCollection(java.util.TreeSet::new));

    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    YearMonth currentMonth = YearMonth.from(today);
    GoldenDayGoalEntity currentGoal = goldenDayGoalService.getEffectiveOn(today, goalsAsc);

    int monthCount = (int) goldenDates.stream()
        .filter(date -> YearMonth.from(date).equals(currentMonth))
        .count();

    int currentStreak = computeStreak(goldenDates, today);

    return GoldenDayStats.builder()
        .monthCount(monthCount)
        .currentStreak(currentStreak)
        .todayGolden(goldenDates.contains(today))
        .todayPushups(pushupsByDay.getOrDefault(today, 0))
        .todayElevationGain(elevationByDay.getOrDefault(today, 0d))
        .pushupGoal(currentGoal.getPushupGoal())
        .elevationGoal(currentGoal.getElevationGoal())
        .goldenDates(goldenDates.stream().sorted().toList())
        .build();
  }

  public boolean isTodayGolden(ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    int todayPushups = pushupSetRepository
        .findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream()
        .filter(set -> set.getCreatedAt().withZoneSameInstant(zoneId).toLocalDate().equals(today))
        .mapToInt(PushupSet::getCount)
        .sum();
    double todayElevation = rideRepository
        .findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream()
        .filter(ride -> ride.getCreatedAt().withZoneSameInstant(zoneId).toLocalDate().equals(today))
        .mapToDouble(ride -> (double) ride.getTotalElevationGain())
        .sum();
    GoldenDayGoalEntity goal = goldenDayGoalService.getEffectiveOn(
        today, goldenDayGoalService.getAllOrderedAsc());
    return todayPushups >= goal.getPushupGoal() && todayElevation >= goal.getElevationGoal();
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
