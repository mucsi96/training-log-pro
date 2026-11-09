package mucsi96.traininglog.daygoal;

import java.time.LocalDate;
import java.time.ZonedDateTime;

import org.springframework.data.jpa.repository.JpaRepository;

import mucsi96.traininglog.api.DayGoalTier;

public interface AchievedDayRepository extends JpaRepository<AchievedDayEntity, LocalDate> {
  long countByTierAndAchievedAtGreaterThan(DayGoalTier tier, ZonedDateTime achievedAt);
}
