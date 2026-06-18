package mucsi96.traininglog.learning;

import java.time.ZonedDateTime;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import mucsi96.traininglog.api.LearningPathContent;

@Data
@Entity
@Table(name = "learning_path", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class LearningPathEntity {
  @Id
  private UUID id;

  @Column(nullable = false)
  private String title;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private LearningPathContent content;

  @Column(name = "created_at", nullable = false)
  private ZonedDateTime createdAt;

  @Column(name = "completed_at")
  private ZonedDateTime completedAt;
}
