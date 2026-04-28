package mucsi96.traininglog.pushups;

import java.time.ZonedDateTime;
import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PushupSetRepository extends JpaRepository<PushupSet, ZonedDateTime> {
  List<PushupSet> findByCreatedAtBetween(ZonedDateTime startTime, ZonedDateTime endTime, Sort sort);

  List<PushupSet> findByCreatedAtBefore(ZonedDateTime endTime, Sort sort);
}
