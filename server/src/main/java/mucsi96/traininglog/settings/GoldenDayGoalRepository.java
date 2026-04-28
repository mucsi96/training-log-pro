package mucsi96.traininglog.settings;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoldenDayGoalRepository extends JpaRepository<GoldenDayGoalEntity, Long> {
  Optional<GoldenDayGoalEntity> findFirstByOrderByEffectiveFromDesc();

  Optional<GoldenDayGoalEntity> findByEffectiveFrom(LocalDate effectiveFrom);

  List<GoldenDayGoalEntity> findAllByOrderByEffectiveFromAsc();

  default List<GoldenDayGoalEntity> findAllOrderedAsc() {
    return findAll(Sort.by(Sort.Direction.ASC, "effectiveFrom"));
  }
}
