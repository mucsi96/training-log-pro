package mucsi96.traininglog.reading;

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
@Table(name = "book", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class BookEntity {
  @Id
  private UUID id;

  @Column(nullable = false)
  private String title;

  @Column(nullable = false)
  private String author;

  @Column(name = "total_pages", nullable = false)
  private int totalPages;

  @Column(name = "created_at", nullable = false)
  private ZonedDateTime createdAt;

  @Column(name = "completed_at")
  private ZonedDateTime completedAt;
}
