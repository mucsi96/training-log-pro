package mucsi96.traininglog.goldenday;

import java.time.LocalDate;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GoldenDayRepository extends JpaRepository<GoldenDayEntity, LocalDate> {
}
