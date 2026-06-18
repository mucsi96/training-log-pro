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
@Table(name = "settings", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SettingsEntity {
  static final int SINGLETON_ID = 1;

  @Id
  private Integer id;

  @Column(name = "pushup_goal", nullable = false)
  private int pushupGoal;

  @Column(name = "elevation_goal", nullable = false)
  private int elevationGoal;

  @Column(name = "reading_pages_goal", nullable = false)
  private int readingPagesGoal;

  @Column(name = "daily_task_goal", nullable = false)
  private int dailyTaskGoal;

  @Column(name = "learning_path_goal", nullable = false)
  private int learningPathGoal;

  @Column(name = "coins_reset_at", nullable = false, insertable = false)
  private ZonedDateTime coinsResetAt;

  @Column(name = "updated_at", nullable = false, insertable = false)
  private ZonedDateTime updatedAt;
}
