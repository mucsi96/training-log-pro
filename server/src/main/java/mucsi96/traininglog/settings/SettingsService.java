package mucsi96.traininglog.settings;

import java.time.Clock;
import java.time.ZonedDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SettingsService {

  private final SettingsRepository repository;
  private final Clock clock;

  @Transactional(readOnly = true)
  public SettingsEntity getCurrent() {
    return repository.findById(SettingsEntity.SINGLETON_ID)
        .orElseThrow(() -> new IllegalStateException("Settings row missing"));
  }

  @Transactional
  public SettingsEntity update(int pushupGoal, int elevationGoal, int readingPagesGoal,
      int dailyTaskGoal, int learningPathGoal) {
    SettingsEntity entity = getCurrent();
    entity.setPushupGoal(pushupGoal);
    entity.setElevationGoal(elevationGoal);
    entity.setReadingPagesGoal(readingPagesGoal);
    entity.setDailyTaskGoal(dailyTaskGoal);
    entity.setLearningPathGoal(learningPathGoal);
    return repository.save(entity);
  }

  @Transactional
  public SettingsEntity resetCoins() {
    SettingsEntity entity = getCurrent();
    entity.setCoinsResetAt(ZonedDateTime.now(clock));
    return repository.save(entity);
  }
}
