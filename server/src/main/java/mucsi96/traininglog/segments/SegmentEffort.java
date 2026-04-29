package mucsi96.traininglog.segments;

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
@Table(schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SegmentEffort {
  @Id
  private long id;

  @Column
  private long segmentId;

  @Column
  private String segmentName;

  @Column
  private float segmentDistance;

  @Column
  private float segmentAverageGrade;

  @Column
  private int elapsedTime;

  @Column
  private ZonedDateTime startDate;

  @Column
  private ZonedDateTime rideCreatedAt;
}
