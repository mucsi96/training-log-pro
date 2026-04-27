package mucsi96.traininglog.fitness;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FitnessRepository extends JpaRepository<Fitness, ZonedDateTime> {
  Optional<Fitness> findFirstByOrderByPulledAtDesc();
  List<Fitness> findByCreatedAtBetween(ZonedDateTime startTime, ZonedDateTime endTime, Sort sort);
  List<Fitness> findByCreatedAtBefore(ZonedDateTime endTime, Sort sort);
}
