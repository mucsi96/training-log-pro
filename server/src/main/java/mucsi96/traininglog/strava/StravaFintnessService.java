package mucsi96.traininglog.strava;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Route;

import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.fitness.Fitness;
import mucsi96.traininglog.fitness.FitnessRepository;
import mucsi96.traininglog.rides.Ride;

@Service
@Slf4j
public class StravaFintnessService {
  private final Browser browser;
  private final StravaConfiguration configuration;
  private final FitnessRepository fitnessRepository;
  private final Clock clock;

  public StravaFintnessService(@Lazy Browser browser, StravaConfiguration configuration,
      FitnessRepository fitnessRepository, Clock clock) {
    this.browser = browser;
    this.configuration = configuration;
    this.fitnessRepository = fitnessRepository;
    this.clock = clock;
  }

  static Optional<StravaFitnessProfile> getTodayFitnessProfile(String responseBody) {
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

  public Optional<Fitness> syncFitness(List<Ride> todayRides, ZoneId zoneId) {
    Optional<Fitness> latest = fitnessRepository.findFirstByOrderByCreatedAtDesc();
    if (!shouldSyncFitness(latest, todayRides, zoneId)) {
      log.info("Skipping fitness sync; already pulled today and no new activities since");
      return Optional.empty();
    }
    Optional<Fitness> fitness = getFitnessLevel();
    fitness.ifPresent(fitnessRepository::save);
    return fitness;
  }

  private boolean shouldSyncFitness(Optional<Fitness> latest, List<Ride> todayRides, ZoneId zoneId) {
    if (latest.isEmpty()) {
      log.info("No fitness pulled yet; triggering first sync");
      return true;
    }
    ZonedDateTime lastPullAt = latest.get().getCreatedAt();
    ZonedDateTime startOfToday = ZonedDateTime.now(clock).withZoneSameInstant(zoneId).truncatedTo(ChronoUnit.DAYS);
    if (lastPullAt.isBefore(startOfToday)) {
      log.info("Last fitness pull was before today; triggering first-of-day sync");
      return true;
    }
    boolean hasNewActivity = todayRides.stream()
        .anyMatch(ride -> ride.getCreatedAt().isAfter(lastPullAt));
    if (hasNewActivity) {
      log.info("New activity detected since last fitness pull; triggering sync");
    }
    return hasNewActivity;
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
      return profile.map(
          value -> Fitness.builder()
              .createdAt(ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC))
              .fitness(value.getFitness())
              .fatigue(value.getFatigue())
              .form(value.getForm())
              .build());
    }
  }
}
