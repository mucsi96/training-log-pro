package mucsi96.traininglog.tasks;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyTaskCompletionRepository
    extends JpaRepository<DailyTaskCompletionEntity, UUID> {
  List<DailyTaskCompletionEntity> findByDate(LocalDate date);

  List<DailyTaskCompletionEntity> findByDateIn(Collection<LocalDate> dates);

  Optional<DailyTaskCompletionEntity> findByTaskIdAndDate(UUID taskId, LocalDate date);

  void deleteByTaskId(UUID taskId);

  void deleteByTaskIdAndDate(UUID taskId, LocalDate date);
}
