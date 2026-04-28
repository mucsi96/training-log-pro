package mucsi96.traininglog.settings;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class GoldenDayGoalService {

  private final GoldenDayGoalRepository repository;

  @Transactional(readOnly = true)
  public GoldenDayGoalEntity getCurrent() {
    return repository.findById(GoldenDayGoalEntity.SINGLETON_ID)
        .orElseThrow(() -> new IllegalStateException("Golden day goal row missing"));
  }

  @Transactional
  public GoldenDayGoalEntity update(int pushupGoal, int elevationGoal) {
    GoldenDayGoalEntity entity = getCurrent();
    entity.setPushupGoal(pushupGoal);
    entity.setElevationGoal(elevationGoal);
    return repository.save(entity);
  }
}
