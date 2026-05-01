package mucsi96.traininglog.reading;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookRepository extends JpaRepository<BookEntity, UUID> {
  List<BookEntity> findAll(Sort sort);
}
