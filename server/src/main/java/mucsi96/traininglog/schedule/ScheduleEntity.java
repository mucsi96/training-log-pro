package mucsi96.traininglog.schedule;

import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import mucsi96.traininglog.api.ScheduleBlock;

@Data
@Entity
@Table(name = "schedule", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ScheduleEntity {

  @Id
  private LocalDate date;

  @Column(name = "commute_mode", nullable = false)
  private String commuteMode;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb", nullable = false)
  private List<ScheduleBlock> blocks;

  @Column(name = "updated_at", insertable = false)
  private ZonedDateTime updatedAt;
}
