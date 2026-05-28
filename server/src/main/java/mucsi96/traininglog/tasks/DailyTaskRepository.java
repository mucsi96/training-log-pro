package mucsi96.traininglog.tasks;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyTaskRepository extends JpaRepository<DailyTaskEntity, UUID> {
  List<DailyTaskEntity> findAll(Sort sort);
}
