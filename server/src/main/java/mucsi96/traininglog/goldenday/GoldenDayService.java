package mucsi96.traininglog.goldenday;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
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

@Service
@RequiredArgsConstructor
public class GoldenDayService {
  static final int PUSHUP_GOAL = 100;
  static final int ELEVATION_GOAL = 250;

  private final PushupSetRepository pushupSetRepository;
  private final RideRepository rideRepository;
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

    Set<LocalDate> goldenDates = pushupsByDay.keySet().stream()
        .filter(date -> pushupsByDay.getOrDefault(date, 0) >= PUSHUP_GOAL)
        .filter(date -> elevationByDay.getOrDefault(date, 0d) >= ELEVATION_GOAL)
        .collect(Collectors.toCollection(java.util.TreeSet::new));

    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    YearMonth currentMonth = YearMonth.from(today);

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
        .pushupGoal(PUSHUP_GOAL)
        .elevationGoal(ELEVATION_GOAL)
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
