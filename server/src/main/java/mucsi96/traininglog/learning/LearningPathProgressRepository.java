package mucsi96.traininglog.learning;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearningPathProgressRepository extends JpaRepository<LearningPathProgressEntity, UUID> {
  List<LearningPathProgressEntity> findByPathId(UUID pathId, Sort sort);

  void deleteByPathId(UUID pathId);
}
