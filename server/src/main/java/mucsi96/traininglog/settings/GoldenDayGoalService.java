package mucsi96.traininglog.settings;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GoldenDayGoalService {

  private final GoldenDayGoalRepository repository;

  public GoldenDayGoalEntity getCurrent() {
    return repository.findFirstByOrderByEffectiveFromDesc()
        .orElseThrow(() -> new IllegalStateException("No golden day goal configured"));
  }

  public List<GoldenDayGoalEntity> getAllOrderedAsc() {
    return repository.findAllByOrderByEffectiveFromAsc();
  }

  public GoldenDayGoalEntity getEffectiveOn(LocalDate date, List<GoldenDayGoalEntity> goalsAsc) {
    GoldenDayGoalEntity match = null;
    for (GoldenDayGoalEntity goal : goalsAsc) {
      if (!goal.getEffectiveFrom().isAfter(date)) {
        match = goal;
      } else {
        break;
      }
    }
    if (match == null) {
      throw new IllegalStateException("No golden day goal effective on " + date);
    }
    return match;
  }

  public GoldenDayGoalEntity save(int pushupGoal, int elevationGoal, LocalDate effectiveFrom) {
    GoldenDayGoalEntity entity = repository.findByEffectiveFrom(effectiveFrom)
        .orElseGet(() -> GoldenDayGoalEntity.builder().effectiveFrom(effectiveFrom).build());
    entity.setPushupGoal(pushupGoal);
    entity.setElevationGoal(elevationGoal);
    return repository.save(entity);
  }
}
