package mucsi96.traininglog.goldenday;

import java.time.LocalDate;
import java.time.ZonedDateTime;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GoldenDayRepository extends JpaRepository<GoldenDayEntity, LocalDate> {
  long countByCreatedAtGreaterThan(ZonedDateTime createdAt);
}
