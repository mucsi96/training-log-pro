package mucsi96.traininglog.strava;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Route;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.fitness.Fitness;

@Service
@Slf4j
@RequiredArgsConstructor
public class StravaFintnessService {
  private final Browser browser;
  private final StravaConfiguration configuration;

  private Optional<StravaFitnessProfile> getTodayFitnessProfile(String responseBody) {
    ObjectMapper mapper = new ObjectMapper();
    List<StravaFitnessResponse> response;
    try {
      response = mapper.readValue(responseBody, new TypeReference<>() {
      });
    } catch (JsonProcessingException e) {
      log.error("Cannot parse fitness response", e);
      return Optional.empty();
    }
    List<StravaFitnessData> dataList = response.get(0).getData();
    return dataList.stream().filter(data -> {
      OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
      int year = data.getDate().getYear();
      int month = data.getDate().getMonth();
      int day = data.getDate().getDay();
      return year == now.getYear() && month == now.getMonthValue() && day == now.getDayOfMonth();
    }).findFirst().map(StravaFitnessData::getFitnessProfile);
  }

  public Optional<Fitness> getFitnessLevel() {
    log.info("Getting fitness");

    try (BrowserContext context = browser.newContext()) {
      Page page = context.newPage();

      AtomicReference<String> fitnessResponseBody = new AtomicReference<>();

      page.route("**/fitness/**", route -> {
        Route.ResumeOptions options = new Route.ResumeOptions();
        route.resume(options);
      });

      page.onResponse(response -> {
        if (response.url().matches(".*\\/fitness\\/\\d+.*") && response.status() == 200) {
          log.info("Intercepted fitness response from: {}", response.url());
          fitnessResponseBody.set(response.text());
        }
      });

      page.navigate(configuration.getApiUri() + "/athlete/fitness");

      log.info("Waiting for login form");
      page.waitForSelector("#email");

      page.fill("#email", configuration.getUsername());
      page.fill("#password", configuration.getPassword());
      page.click("#login-button");

      log.info("Waiting for fitness data to load");
      page.waitForSelector(".fitness-dot");
      log.info("Successful login");

      String body = fitnessResponseBody.get();

      if (body == null) {
        log.error("No matching fitness request");
        return Optional.empty();
      }

      Optional<StravaFitnessProfile> profile = getTodayFitnessProfile(body);
      profile.ifPresent(value -> {
        ObjectMapper mapper = new ObjectMapper();
        try {
          System.out.println(mapper.writeValueAsString(value));
        } catch (JsonProcessingException e) {
        }
      });
      return profile.map(
          value -> Fitness.builder()
              .createdAt(ZonedDateTime.now(ZoneOffset.UTC))
              .fitness(value.getFitness())
              .fatigue(value.getFatigue())
              .form(value.getForm())
              .build());
    }
  }
}
