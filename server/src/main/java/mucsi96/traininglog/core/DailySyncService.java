package mucsi96.traininglog.core;

import java.time.ZoneId;

import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.fitness.FitnessService;
import mucsi96.traininglog.ftp.FtpService;
import mucsi96.traininglog.rides.RideService;
import mucsi96.traininglog.segments.SegmentEffortService;
import mucsi96.traininglog.segments.SegmentService;
import mucsi96.traininglog.strava.StravaActivityService;
import mucsi96.traininglog.strava.StravaSyncResult;
import mucsi96.traininglog.weight.WeightService;
import mucsi96.traininglog.withings.WithingsService;

@Service
@RequiredArgsConstructor
public class DailySyncService {

  private final WithingsService withingsService;
  private final WeightService weightService;
  private final StravaActivityService stravaActivityService;
  private final RideService rideService;
  private final SegmentService segmentService;
  private final SegmentEffortService segmentEffortService;
  private final FitnessService fitnessService;
  private final FtpService ftpService;

  public void syncWeight(OAuth2AuthorizedClient client, ZoneId zoneId) {
    withingsService.getTodayWeight(client, zoneId).ifPresent(weightService::saveWeight);
  }

  public void syncStrava(OAuth2AuthorizedClient client, ZoneId zoneId) {
    StravaSyncResult result = stravaActivityService.getTodayRides(client, zoneId);
    result.getRides().forEach(rideService::saveRide);
    segmentService.saveAll(result.getSegments());
    segmentEffortService.saveAll(result.getSegmentEfforts());
    fitnessService.recompute(zoneId);
    ftpService.recompute(zoneId);
  }
}
