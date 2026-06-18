package mucsi96.traininglog.learning;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LearningPathRepository extends JpaRepository<LearningPathEntity, UUID> {
  List<LearningPathEntity> findAll(Sort sort);
}
