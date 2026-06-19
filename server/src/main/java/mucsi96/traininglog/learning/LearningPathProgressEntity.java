package mucsi96.traininglog.learning;

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
@Table(name = "learning_path_progress", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class LearningPathProgressEntity {
  @Id
  private UUID id;

  @Column(name = "path_id", nullable = false)
  private UUID pathId;

  @Column(name = "created_at", nullable = false)
  private ZonedDateTime createdAt;

  @Column(name = "duration_minutes", nullable = false)
  private int durationMinutes;

  @Column(nullable = false)
  private String description;

  @Column
  private String comment;
}
