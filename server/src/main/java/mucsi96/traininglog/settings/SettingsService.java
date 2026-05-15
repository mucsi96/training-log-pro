package mucsi96.traininglog.settings;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SettingsService {

  private final SettingsRepository repository;

  @Transactional(readOnly = true)
  public SettingsEntity getCurrent() {
    return repository.findById(SettingsEntity.SINGLETON_ID)
        .orElseThrow(() -> new IllegalStateException("Settings row missing"));
  }

  @Transactional
  public SettingsEntity update(
      int pushupGoal,
      int elevationGoal,
      int readingPagesGoal,
      int pushupDefaultSetSize,
      int pushupMaxSetSize) {
    SettingsEntity entity = getCurrent();
    entity.setPushupGoal(pushupGoal);
    entity.setElevationGoal(elevationGoal);
    entity.setReadingPagesGoal(readingPagesGoal);
    entity.setPushupDefaultSetSize(pushupDefaultSetSize);
    entity.setPushupMaxSetSize(pushupMaxSetSize);
    return repository.save(entity);
  }
}
