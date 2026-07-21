package mucsi96.traininglog.apitoken;

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
@Table(name = "api_token", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ApiTokenEntity {
  @Id
  private UUID id;

  @Column(nullable = false)
  private String name;

  @Column(name = "encrypted_token", nullable = false)
  private String encryptedToken;

  @Column(name = "created_at", nullable = false)
  private ZonedDateTime createdAt;
}
