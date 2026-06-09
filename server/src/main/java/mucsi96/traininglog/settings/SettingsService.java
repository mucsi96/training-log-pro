package mucsi96.traininglog.settings;

import java.time.Clock;
import java.time.ZonedDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.Settings;

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
  public SettingsEntity update(Settings request) {
    SettingsEntity entity = getCurrent();
    entity.setPushupGoal(request.getPushupGoal());
    entity.setElevationGoal(request.getElevationGoal());
    entity.setReadingPagesGoal(request.getReadingPagesGoal());
    entity.setDailyTaskGoal(request.getDailyTaskGoal());
    entity.setHomeLat(request.getHomeLat());
    entity.setHomeLng(request.getHomeLng());
    entity.setOfficeAddress(request.getOfficeAddress());
    entity.setSchoolAddress(request.getSchoolAddress());
    entity.setWorkStartTime(request.getWorkStartTime());
    entity.setWorkEndTime(request.getWorkEndTime());
    entity.setSonPickupTime(request.getSonPickupTime());
    entity.setCommuteBikeMinutes(request.getCommuteBikeMinutes());
    entity.setCommuteCarMinutes(request.getCommuteCarMinutes());
    entity.setRainThresholdMm(request.getRainThresholdMm());
    entity.setPomodoroMinutes(request.getPomodoroMinutes());
    entity.setTrainingRideMinutes(request.getTrainingRideMinutes());
    entity.setGermanCardsMinutes(request.getGermanCardsMinutes());
    entity.setReadingMinutes(request.getReadingMinutes());
    entity.setGermanWithWifeMinutes(request.getGermanWithWifeMinutes());
    entity.setFlashcardCreationMinutes(request.getFlashcardCreationMinutes());
    return repository.save(entity);
  }

  @Transactional
  public SettingsEntity resetCoins() {
    SettingsEntity entity = getCurrent();
    entity.setCoinsResetAt(ZonedDateTime.now(clock));
    return repository.save(entity);
  }
}
