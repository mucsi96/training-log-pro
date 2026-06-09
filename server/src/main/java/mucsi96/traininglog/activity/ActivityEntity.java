package mucsi96.traininglog.activity;

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
@Table(name = "activity", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ActivityEntity {
  @Id
  private UUID id;

  @Column(nullable = false)
  private String name;

  @Column(name = "duration_minutes", nullable = false)
  private int durationMinutes;

  @Column(name = "occurrences_per_week", nullable = false)
  private int occurrencesPerWeek;

  @Column(name = "location_id")
  private UUID locationId;

  @Column(name = "earliest_time")
  private String earliestTime;

  @Column(name = "latest_time")
  private String latestTime;

  @Column(name = "days_of_week")
  private String daysOfWeek;

  @Column(name = "constraint_note")
  private String constraintNote;

  @Column
  private Integer priority;

  @Column(name = "created_at", nullable = false)
  private ZonedDateTime createdAt;
}
