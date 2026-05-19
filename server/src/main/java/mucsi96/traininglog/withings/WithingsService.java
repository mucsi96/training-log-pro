package mucsi96.traininglog.withings;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.client.ClientAuthorizationRequiredException;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.weight.Weight;

@Service
@RequiredArgsConstructor
@Slf4j
public class WithingsService {

  private static final int MEASURE_TYPE_WEIGHT = 1;
  private static final int MEASURE_TYPE_FAT_RATIO = 6;
  private static final int MEASURE_TYPE_FAT_MASS_WEIGHT = 8;

  private final WithingsConfiguration withingsConfiguration;
  private final Clock clock;

  private String getMeasureUrl(ZoneId zoneId) {
    long startTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS).toEpochSecond();
    long endTime = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS).plusDays(1)
        .toEpochSecond();
    log.info("Getting today last weight measure from {} to {}", startTime, endTime);
    return UriComponentsBuilder
        .fromUriString(withingsConfiguration.getApiUri())
        .path("/measure")
        .queryParam("action", "getmeas")
        .queryParam("category", 1)
        .queryParam("startdate", startTime)
        .queryParam("enddate", endTime)
        .build()
        .encode()
        .toUriString();
  }

  private WithingsGetMeasureResponseBody getMeasure(OAuth2AuthorizedClient authorizedClient, ZoneId zoneId) {
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(authorizedClient.getAccessToken().getTokenValue());
    HttpEntity<String> request = new HttpEntity<>("", headers);
    RestTemplate restTemplate = new RestTemplate();
    WithingsGetMeasureResponse response = restTemplate
        .postForObject(getMeasureUrl(zoneId), request, WithingsGetMeasureResponse.class);

    if (response == null) {
      throw new WithingsTechnicalException();
    }

    if (response.getStatus() == 401) {
      throw new ClientAuthorizationRequiredException(WithingsConfiguration.registrationId);
    }

    if (response.getStatus() != 0) {
      log.error("Withings returned non-zero status: status={} error={}", response.getStatus(), response.getError());
      throw new WithingsTechnicalException();
    }

    WithingsGetMeasureResponseBody body = response.getBody();
    List<WithingsMeasureGroup> measureGroups = body != null ? body.getMeasuregrps() : null;
    log.info("Withings returned {} measure groups for today", measureGroups == null ? 0 : measureGroups.size());
    if (measureGroups != null) {
      measureGroups.forEach(group -> log.info(
          "Withings measure group: grpid={} date={} category={} deviceid={} measures={}",
          group.getGrpid(),
          ZonedDateTime.ofInstant(Instant.ofEpochSecond(group.getDate()), ZoneOffset.UTC),
          group.getCategory(), group.getDeviceid(),
          formatMeasures(group.getMeasures())));
    }

    return body;
  }

  private String formatMeasures(List<WithingsMeasure> measures) {
    if (measures == null || measures.isEmpty()) {
      return "[]";
    }
    return measures.stream()
        .map(m -> String.format("{type=%d value=%d unit=%d}", m.getType(), m.getValue(), m.getUnit()))
        .reduce((a, b) -> a + ", " + b)
        .map(s -> "[" + s + "]")
        .orElse("[]");
  }

  private Optional<Float> getMeasurement(List<WithingsMeasure> measures, int type) {
    return measures.stream()
        .filter(m -> m.getType() == type)
        .findFirst()
        .map(m -> Math.round(m.getValue() * Math.pow(10, m.getUnit()) * 10.0) / 10.0f);
  }

  private Optional<Weight> getLastMeasureValue(WithingsGetMeasureResponseBody measureResponseBody) {
    List<WithingsMeasureGroup> measureGroups = measureResponseBody.getMeasuregrps();

    if (measureGroups == null || measureGroups.isEmpty()) {
      return Optional.empty();
    }

    WithingsMeasureGroup measureGroup = measureGroups.get(measureGroups.size() - 1);

    List<WithingsMeasure> measures = measureGroup.getMeasures();

    if (measures == null || measures.isEmpty()) {
      return Optional.empty();
    }

    Optional<Float> weight = getMeasurement(measures, MEASURE_TYPE_WEIGHT);
    if (weight.isEmpty()) {
      log.info("Withings measure group {} has no weight measurement, skipping", measureGroup.getGrpid());
      return Optional.empty();
    }

    return Optional.of(
        Weight
            .builder()
            .createdAt(ZonedDateTime.ofInstant(Instant.ofEpochSecond(measureGroup.getDate()), ZoneOffset.UTC))
            .weight(weight.get())
            .fatRatio(getMeasurement(measures, MEASURE_TYPE_FAT_RATIO).orElse(null))
            .fatMassWeight(getMeasurement(measures, MEASURE_TYPE_FAT_MASS_WEIGHT).orElse(null))
            .build());
  }

  public Optional<Weight> getTodayWeight(OAuth2AuthorizedClient authorizedClient, ZoneId zoneId) {
    Optional<Weight> result = getLastMeasureValue(getMeasure(authorizedClient, zoneId));
    if (result.isPresent()) {
      Weight weight = result.get();
      log.info(
          "Withings weight to persist: created_at={} weight_kg={} fat_ratio_pct={} fat_mass_weight_kg={}",
          weight.getCreatedAt(), weight.getWeight(), weight.getFatRatio(), weight.getFatMassWeight());
    } else {
      log.info("Withings sync produced no weight measurement for today");
    }
    return result;
  }
}
