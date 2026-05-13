package mucsi96.traininglog.weight;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeightRepository extends JpaRepository<Weight, ZonedDateTime> {
  List<Weight> findByCreatedAtBetween(ZonedDateTime startTime, ZonedDateTime endTime, Sort sort);
  List<Weight> findByCreatedAtBefore(ZonedDateTime endTime, Sort sort);
  Optional<Weight> findFirstByCreatedAtBeforeOrderByCreatedAtDesc(ZonedDateTime startTime);
}
