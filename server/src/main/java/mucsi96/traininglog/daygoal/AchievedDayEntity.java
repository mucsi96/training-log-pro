package mucsi96.traininglog.daygoal;

import java.time.LocalDate;
import java.time.ZonedDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import mucsi96.traininglog.api.DayGoalTier;

/**
 * A day on which a day goal tier was reached. The tier only ever goes up: a day
 * is upgraded when a more demanding tier is reached later, and tightening the
 * requirements afterwards never takes an awarded tier away.
 */
@Data
@Entity
@Table(name = "achieved_day", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AchievedDayEntity {
  @Id
  private LocalDate date;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private DayGoalTier tier;

  /** When the current tier was reached. */
  @Column(name = "achieved_at", nullable = false)
  private ZonedDateTime achievedAt;

  @Column(name = "celebrated_at")
  private ZonedDateTime celebratedAt;
}
