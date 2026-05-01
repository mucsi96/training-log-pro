package mucsi96.traininglog.reading;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReadingProgressRepository extends JpaRepository<ReadingProgressEntity, UUID> {
  List<ReadingProgressEntity> findAll(Sort sort);

  List<ReadingProgressEntity> findByBookId(UUID bookId, Sort sort);

  void deleteByBookId(UUID bookId);
}
