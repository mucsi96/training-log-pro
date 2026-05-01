package mucsi96.traininglog.settings;

import java.time.ZonedDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
  static final int SINGLETON_ID = 1;

  @Id
  private Integer id;

  @Column(name = "pushup_goal", nullable = false)
  private int pushupGoal;

  @Column(name = "elevation_goal", nullable = false)
  private int elevationGoal;

  @Column(name = "reading_pages_goal", nullable = false)
  private int readingPagesGoal;

  @Column(name = "updated_at", nullable = false, insertable = false)
  private ZonedDateTime updatedAt;
}
