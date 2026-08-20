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
@Table(name = "device_book", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DeviceBookEntity {
  @Id
  private UUID id;

  @Column(name = "device_id", nullable = false)
  private UUID deviceId;

  @Column(name = "file_name", nullable = false)
  private String fileName;

  @Column(name = "content_type", nullable = false)
  private String contentType;

  @Column(nullable = false)
  private byte[] data;

  @Column(name = "created_at", nullable = false)
  private ZonedDateTime createdAt;
}
