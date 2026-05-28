package mucsi96.traininglog.tasks;

import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DailyTaskCompletionRepository
    extends JpaRepository<DailyTaskCompletionEntity, UUID> {
  List<DailyTaskCompletionEntity> findByDate(LocalDate date);

  List<DailyTaskCompletionEntity> findByDateIn(Collection<LocalDate> dates);

  void deleteByTaskId(UUID taskId);

  void deleteByTaskIdAndDate(UUID taskId, LocalDate date);

  @Modifying
  @Query(value = "INSERT INTO training_log.daily_task_completion (id, task_id, date, completed_at) "
      + "VALUES (:id, :taskId, :date, :completedAt) "
      + "ON CONFLICT (task_id, date) DO NOTHING", nativeQuery = true)
  void insertIfAbsent(
      @Param("id") UUID id,
      @Param("taskId") UUID taskId,
      @Param("date") LocalDate date,
      @Param("completedAt") ZonedDateTime completedAt);
}
