package mucsi96.traininglog.schedule;

import java.time.LocalDate;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduleRepository extends JpaRepository<ScheduleEntity, LocalDate> {
}
