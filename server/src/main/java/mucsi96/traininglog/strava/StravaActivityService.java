package mucsi96.traininglog.strava;

import java.time.Clock;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.client.ClientAuthorizationRequiredException;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.rides.Ride;
import mucsi96.traininglog.segments.SegmentEffort;
import mucsi96.traininglog.strava.StravaSummaryActivity.SportTypeEnum;

@Service
@RequiredArgsConstructor
@Slf4j
public class StravaActivityService {
  private final StravaConfiguration configuration;
  private final Clock clock;

  private String getActivitiesUrl(ZoneId zoneId) {
    long startTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS).toEpochSecond();
    long endTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS).plusDays(1)
        .toEpochSecond();
    log.info("Getting today activities from {} to {}", startTime, endTime);
    return UriComponentsBuilder
        .fromUriString(configuration.getApiUri())
        .path("/api/v3/athlete/activities")
        .queryParam("after", startTime)
        .queryParam("before", endTime)
        .build()
        .encode()
        .toUriString();
  }

  private List<StravaSummaryActivity> getTodayRideActivities(OAuth2AuthorizedClient authorizedClient, ZoneId zoneId) {
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(authorizedClient.getAccessToken().getTokenValue());
    HttpEntity<String> request = new HttpEntity<>("", headers);
    RestTemplate restTemplate = new RestTemplate();
    ResponseEntity<List<StravaSummaryActivity>> response = restTemplate.exchange(getActivitiesUrl(zoneId),
        HttpMethod.GET, request,
        new ParameterizedTypeReference<List<StravaSummaryActivity>>() {
        }, headers);

    if (response.getStatusCode() == HttpStatusCode.valueOf(401)) {
      throw new ClientAuthorizationRequiredException(StravaConfiguration.registrationId);
    }

    if (response.getStatusCode() != HttpStatusCode.valueOf(200)) {
      throw new StravaTechnicalException();
    }

    List<StravaSummaryActivity> activities = response.getBody();

    if (activities == null) {
      log.info("Strava returned no activities for today");
      return List.of();
    }

    log.info("Strava returned {} summary activities for today", activities.size());
    activities.forEach(activity -> log.info(
        "Strava summary activity: id={} sport_type={} start_date={} name={} suffer_score={}",
        activity.getId(), activity.getSportType(), activity.getStartDate(), activity.getName(),
        activity.getSufferScore()));

    List<SportTypeEnum> rideSportTypes = List.of(SportTypeEnum.RIDE, SportTypeEnum.GRAVELRIDE,
        SportTypeEnum.MOUNTAINBIKERIDE, SportTypeEnum.VIRTUALRIDE);

    List<StravaSummaryActivity> rides = activities.stream()
        .filter(activity -> rideSportTypes.contains(activity.getSportType()))
        .toList();
    log.info("Filtered to {} ride activities (sport_types={})", rides.size(), rideSportTypes);
    return rides;
  }

  public StravaSyncResult getTodayRides(OAuth2AuthorizedClient authorizedClient, ZoneId zoneId) {
    List<Ride> rides = new ArrayList<>();
    List<SegmentEffort> segmentEfforts = new ArrayList<>();

    getTodayRideActivities(authorizedClient, zoneId).forEach(summary -> {
      log.info("Fetching Strava activity detail id={}", summary.getId());
      HttpHeaders headers = new HttpHeaders();
      headers.setBearerAuth(authorizedClient.getAccessToken().getTokenValue());
      HttpEntity<String> request = new HttpEntity<>("", headers);
      RestTemplate restTemplate = new RestTemplate();
      ResponseEntity<StravaDetailedActivity> response = restTemplate.exchange(
          configuration.getApiUri() + "/api/v3/activities/" + summary.getId(),
          HttpMethod.GET, request,
          StravaDetailedActivity.class, headers);
      StravaDetailedActivity activity = response.getBody();

      if (response.getStatusCode() == HttpStatusCode.valueOf(401)) {
        throw new ClientAuthorizationRequiredException(StravaConfiguration.registrationId);
      }

      if (response.getStatusCode() != HttpStatusCode.valueOf(200)) {
        throw new StravaTechnicalException();
      }

      if (activity == null) {
        throw new RuntimeException("No matching activity");
      }

      Float sufferScore = activity.getSufferScore() != null ? activity.getSufferScore() : summary.getSufferScore();
      ZonedDateTime rideCreatedAt = activity.getStartDate().atZoneSameInstant(ZoneOffset.UTC);

      if (sufferScore == null) {
        log.error(
            "Strava activity id={} name={} returned no suffer_score (detail null, summary null). "
                + "Fitness cannot be computed for this ride. Common causes: athlete is not a Strava Premium subscriber, "
                + "activity has no heart-rate data, or Strava has not finished processing the activity yet.",
            activity.getId(), activity.getName());
      }

      Ride ride = Ride.builder()
          .createdAt(rideCreatedAt)
          .name(activity.getName())
          .movingTime(activity.getMovingTime())
          .distance(activity.getDistance())
          .totalElevationGain(activity.getTotalElevationGain())
          .weightedAverageWatts(activity.getWeightedAverageWatts())
          .calories(activity.getCalories())
          .sportType(activity.getSportType())
          .sufferScore(sufferScore)
          .build();
      rides.add(ride);

      log.info(
          "Strava ride to persist: id={} created_at={} name={} sport_type={} distance_m={} moving_time_s={} "
              + "elevation_gain_m={} weighted_avg_watts={} calories={} suffer_score={}",
          activity.getId(), ride.getCreatedAt(), ride.getName(), ride.getSportType(),
          ride.getDistance(), ride.getMovingTime(), ride.getTotalElevationGain(),
          ride.getWeightedAverageWatts(), ride.getCalories(), ride.getSufferScore());

      List<SegmentEffort> efforts = Optional.ofNullable(activity.getSegmentEfforts())
          .orElse(List.of())
          .stream()
          .map(effort -> toSegmentEffort(effort, rideCreatedAt))
          .toList();
      efforts.forEach(effort -> log.info(
          "Strava segment effort to persist: id={} segment_id={} segment_name={} distance_m={} "
              + "avg_grade={} elapsed_time_s={} start_date={} ride_created_at={}",
          effort.getId(), effort.getSegmentId(), effort.getSegmentName(), effort.getSegmentDistance(),
          effort.getSegmentAverageGrade(), effort.getElapsedTime(), effort.getStartDate(),
          effort.getRideCreatedAt()));
      segmentEfforts.addAll(efforts);
    });

    log.info("Strava sync prepared {} rides and {} segment efforts for persistence",
        rides.size(), segmentEfforts.size());

    return StravaSyncResult.builder().rides(rides).segmentEfforts(segmentEfforts).build();
  }

  private SegmentEffort toSegmentEffort(StravaSegmentEffort effort, ZonedDateTime rideCreatedAt) {
    StravaSegment segment = effort.getSegment();
    return SegmentEffort.builder()
        .id(effort.getId())
        .segmentId(segment.getId())
        .segmentName(segment.getName())
        .segmentDistance(segment.getDistance())
        .segmentAverageGrade(segment.getAverageGrade())
        .elapsedTime(effort.getElapsedTime())
        .startDate(effort.getStartDate().atZoneSameInstant(ZoneOffset.UTC))
        .rideCreatedAt(rideCreatedAt)
        .build();
  }

}
