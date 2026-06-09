package mucsi96.traininglog.schedule;

import java.time.LocalDate;

import org.springframework.data.jpa.repository.JpaRepository;

public interface WeekPlanRepository extends JpaRepository<WeekPlanEntity, LocalDate> {
}
