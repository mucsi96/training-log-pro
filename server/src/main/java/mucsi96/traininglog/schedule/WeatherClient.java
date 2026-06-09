package mucsi96.traininglog.schedule;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.extern.slf4j.Slf4j;

/**
 * Fetches today's forecast from Open-Meteo (keyless, no auth) to decide bike vs
 * car for the office commute.
 */
@Component
@Slf4j
public class WeatherClient {

  private final RestClient restClient;

  public WeatherClient(@Value("${weather.api-uri}") String apiUri) {
    this.restClient = RestClient.builder().baseUrl(apiUri).build();
  }

  public WeatherForecast getTodayForecast(double latitude, double longitude) {
    String uri = UriComponentsBuilder.fromPath("/v1/forecast")
        .queryParam("latitude", latitude)
        .queryParam("longitude", longitude)
        .queryParam("hourly", "precipitation,temperature_2m")
        .queryParam("forecast_days", 1)
        .queryParam("timezone", "auto")
        .toUriString();

    log.info("Fetching weather forecast from Open-Meteo");
    OpenMeteoResponse response = restClient.get().uri(uri).retrieve().body(OpenMeteoResponse.class);

    if (response == null || response.hourly() == null) {
      throw new IllegalStateException("Empty weather response");
    }

    List<Double> precipitation = response.hourly().precipitation();
    List<Double> temperature = response.hourly().temperature();

    double maxPrecipitation = precipitation.stream().mapToDouble(Double::doubleValue).max().orElse(0);
    double maxTemperature = temperature.stream().mapToDouble(Double::doubleValue).max().orElse(0);
    double minTemperature = temperature.stream().mapToDouble(Double::doubleValue).min().orElse(0);

    return new WeatherForecast(maxPrecipitation, maxTemperature, minTemperature);
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record OpenMeteoResponse(Hourly hourly) {
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record Hourly(
      List<Double> precipitation,
      @JsonProperty("temperature_2m") List<Double> temperature) {
  }
}
