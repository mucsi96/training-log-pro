package mucsi96.traininglog.schedule;

import java.time.Duration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.extern.slf4j.Slf4j;

/**
 * Fetches the daily precipitation forecast from Open-Meteo (keyless, no auth) so
 * the planner can decide bike vs car per day for the office commute.
 */
@Component
@Slf4j
public class WeatherClient {

  private final RestClient restClient;

  public WeatherClient(@Value("${weather.api-uri}") String apiUri) {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(Duration.ofSeconds(10));
    factory.setReadTimeout(Duration.ofSeconds(15));
    this.restClient = RestClient.builder().baseUrl(apiUri).requestFactory(factory).build();
  }

  /** Returns precipitation (mm) keyed by date for the upcoming days. */
  public Map<LocalDate, Double> getDailyPrecipitation(double latitude, double longitude) {
    String uri = UriComponentsBuilder.fromPath("/v1/forecast")
        .queryParam("latitude", latitude)
        .queryParam("longitude", longitude)
        .queryParam("daily", "precipitation_sum")
        .queryParam("forecast_days", 16)
        .queryParam("timezone", "auto")
        .toUriString();

    log.info("Fetching daily precipitation from Open-Meteo");
    OpenMeteoResponse response = restClient.get().uri(uri).retrieve().body(OpenMeteoResponse.class);

    Map<LocalDate, Double> precipitation = new HashMap<>();
    if (response == null || response.daily() == null) {
      return precipitation;
    }

    List<String> dates = response.daily().time();
    List<Double> sums = response.daily().precipitationSum();
    if (dates == null || sums == null) {
      return precipitation;
    }

    for (int i = 0; i < dates.size() && i < sums.size(); i++) {
      precipitation.put(LocalDate.parse(dates.get(i)), sums.get(i) == null ? 0d : sums.get(i));
    }
    return precipitation;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record OpenMeteoResponse(Daily daily) {
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record Daily(
      List<String> time,
      @JsonProperty("precipitation_sum") List<Double> precipitationSum) {
  }
}
