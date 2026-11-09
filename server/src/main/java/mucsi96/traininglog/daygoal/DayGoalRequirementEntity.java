package mucsi96.traininglog.daygoal;

import java.util.UUID;

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
import mucsi96.traininglog.api.DayGoalMetric;
import mucsi96.traininglog.api.DayGoalTier;

/**
 * One metric a tier requires and the amount of it. A tier is defined entirely by
 * its rows here: a metric without a row is not required for the tier, and a tier
 * without any row is never awarded.
 */
@Data
@Entity
@Table(name = "day_goal_requirement", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DayGoalRequirementEntity {
  @Id
  private UUID id;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private DayGoalTier tier;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private DayGoalMetric metric;

  @Column(nullable = false)
  private int goal;
}
