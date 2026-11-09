package mucsi96.traininglog.tasks;

import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.UUID;

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
@Table(name = "daily_task_completion", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DailyTaskCompletionEntity {
  @Id
  private UUID id;

  @Column(name = "task_id", nullable = false)
  private UUID taskId;

  @Column(nullable = false)
  private LocalDate date;

  @Column(name = "completed_at", nullable = false)
  private ZonedDateTime completedAt;
}
