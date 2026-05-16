package mucsi96.traininglog.coins;

import java.time.ZonedDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.Coins;
import mucsi96.traininglog.goldenday.GoldenDayRepository;
import mucsi96.traininglog.settings.SettingsEntity;
import mucsi96.traininglog.settings.SettingsService;

@Service
@RequiredArgsConstructor
public class CoinsService {

  static final int POINTS_PER_COIN = 5;

  private final GoldenDayRepository goldenDayRepository;
  private final SettingsService settingsService;

  @Transactional(readOnly = true)
  public Coins getCoins() {
    return buildCoins(settingsService.getCurrent());
  }

  @Transactional
  public Coins resetCoins() {
    return buildCoins(settingsService.resetCoins());
  }

  private Coins buildCoins(SettingsEntity settings) {
    ZonedDateTime resetAt = settings.getCoinsResetAt();
    int totalCoins = (int) goldenDayRepository.countByCreatedAtGreaterThan(resetAt);
    return Coins.builder()
        .totalCoins(totalCoins)
        .totalPoints(totalCoins * POINTS_PER_COIN)
        .pointsPerCoin(POINTS_PER_COIN)
        .build();
  }
}
