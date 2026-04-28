package mucsi96.traininglog.goldenday;

import java.time.LocalDate;
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
@Table(name = "golden_day", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class GoldenDayEntity {
  @Id
  private LocalDate date;

  @Column(name = "created_at", nullable = false, insertable = false)
  private ZonedDateTime createdAt;
}
