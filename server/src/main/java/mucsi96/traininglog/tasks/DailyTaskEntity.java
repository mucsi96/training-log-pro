package mucsi96.traininglog.tasks;

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
@Table(name = "daily_task", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DailyTaskEntity {
  @Id
  private UUID id;

  @Column(nullable = false)
  private String name;

  @Column(name = "created_at", nullable = false)
  private ZonedDateTime createdAt;
}
