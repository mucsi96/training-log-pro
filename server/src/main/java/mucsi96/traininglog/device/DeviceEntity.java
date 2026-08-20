package mucsi96.traininglog.device;

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
@Table(name = "device", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DeviceEntity {
  @Id
  private UUID id;

  @Column(nullable = false)
  private String name;

  @Column(name = "encrypted_key", nullable = false)
  private String encryptedKey;

  @Column(name = "created_at", nullable = false)
  private ZonedDateTime createdAt;
}
