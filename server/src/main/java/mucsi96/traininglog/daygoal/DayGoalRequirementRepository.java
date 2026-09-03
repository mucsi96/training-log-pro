package mucsi96.traininglog.daygoal;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DayGoalRequirementRepository extends JpaRepository<DayGoalRequirementEntity, UUID> {
}
