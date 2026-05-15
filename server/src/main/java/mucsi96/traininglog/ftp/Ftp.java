package mucsi96.traininglog.ftp;

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
public class Ftp {
  @Id
  private ZonedDateTime createdAt;

  @Column
  private ZonedDateTime pulledAt;

  @Column
  private float ftp;

  @Column
  private float weight;

  @Column
  private float ftpPerKg;
}
