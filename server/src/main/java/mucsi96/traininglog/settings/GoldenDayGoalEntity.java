package mucsi96.traininglog.settings;

import java.time.LocalDate;
import java.time.ZonedDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Entity
@Table(name = "golden_day_goal", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class GoldenDayGoalEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "effective_from", nullable = false, unique = true)
  private LocalDate effectiveFrom;

  @Column(name = "pushup_goal", nullable = false)
  private int pushupGoal;

  @Column(name = "elevation_goal", nullable = false)
  private int elevationGoal;

  @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
  private ZonedDateTime createdAt;
}
