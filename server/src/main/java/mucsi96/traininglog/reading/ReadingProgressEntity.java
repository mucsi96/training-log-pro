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
@Table(name = "reading_progress", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ReadingProgressEntity {
  @Id
  @Column(name = "created_at")
  private ZonedDateTime createdAt;

  @Column(name = "book_id", nullable = false)
  private UUID bookId;

  @Column(name = "current_page", nullable = false)
  private int currentPage;
}
