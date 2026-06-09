package mucsi96.traininglog.location;

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
@Table(name = "location", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class LocationEntity {
  @Id
  private UUID id;

  @Column(nullable = false)
  private String name;

  @Column
  private String address;

  @Column
  private Double latitude;

  @Column
  private Double longitude;

  @Column(nullable = false)
  private boolean home;

  @Column(name = "bike_minutes_from_home")
  private Integer bikeMinutesFromHome;

  @Column(name = "car_minutes_from_home")
  private Integer carMinutesFromHome;

  @Column(name = "created_at", nullable = false)
  private ZonedDateTime createdAt;
}
