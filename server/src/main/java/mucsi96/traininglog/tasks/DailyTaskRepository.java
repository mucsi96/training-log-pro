package mucsi96.traininglog.tasks;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface DailyTaskRepository extends JpaRepository<DailyTaskEntity, UUID> {
  @Query(value = """
      SELECT task.* FROM training_log.daily_task task
      LEFT JOIN (
        SELECT task_id, MAX(completed_at) AS last_completed_at
        FROM training_log.daily_task_completion
        GROUP BY task_id
      ) completion ON completion.task_id = task.id
      ORDER BY completion.last_completed_at DESC NULLS LAST, task.created_at ASC, task.id ASC
      """, nativeQuery = true)
  List<DailyTaskEntity> findAllByLatestCompletion();
}
