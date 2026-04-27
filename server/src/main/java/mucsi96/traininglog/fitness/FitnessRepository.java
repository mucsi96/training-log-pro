package mucsi96.traininglog.fitness;

import java.time.ZonedDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FitnessRepository extends JpaRepository<Fitness, ZonedDateTime> {
  Optional<Fitness> findFirstByOrderByCreatedAtDesc();
}
