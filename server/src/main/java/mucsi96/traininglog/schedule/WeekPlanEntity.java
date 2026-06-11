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
import mucsi96.traininglog.api.DaySchedule;
import mucsi96.traininglog.api.MeetingReview;

@Data
@Entity
@Table(name = "week_plan", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WeekPlanEntity {

  @Id
  @Column(name = "week_start")
  private LocalDate weekStart;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb", nullable = false)
  private List<MeetingReview> meetings;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb", nullable = false)
  private List<DaySchedule> days;

  @Column(name = "updated_at", nullable = false)
  private ZonedDateTime updatedAt;
}
