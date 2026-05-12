package mucsi96.traininglog.rides;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
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
public class Ride {
  @Id
  private ZonedDateTime createdAt;

  @Column(nullable = false)
  private ZonedDateTime updatedAt;

  @Column
  private String name;

  @Column
  private int movingTime;

  @Column
  private float distance;

  @Column
  private float totalElevationGain;

  @Column
  private float weightedAverageWatts;

  @Column
  private float calories;

  @Column
  private String sportType;

  @Column
  private Float sufferScore;

  @PrePersist
  @PreUpdate
  private void touchUpdatedAt() {
    this.updatedAt = ZonedDateTime.now(ZoneOffset.UTC);
  }
}
