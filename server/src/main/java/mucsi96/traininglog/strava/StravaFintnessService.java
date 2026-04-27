package mucsi96.traininglog.strava;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.Route;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.LoadState;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.core.PlaywrightConfiguration;
import mucsi96.traininglog.fitness.Fitness;
import mucsi96.traininglog.fitness.FitnessRepository;
import mucsi96.traininglog.rides.Ride;

@Service
@Slf4j
@RequiredArgsConstructor
public class StravaFintnessService {
  private final PlaywrightConfiguration playwrightConfiguration;
  private final StravaConfiguration configuration;
  private final FitnessRepository fitnessRepository;
  private final Clock clock;
  private final Environment environment;

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
    String wsEndpoint = playwrightConfiguration.getWsEndpoint();
    log.info("Connecting to remote Playwright server at {}", wsEndpoint);

    try (Playwright playwright = Playwright.create();
        Browser browser = playwright.chromium().connect(wsEndpoint);
        BrowserContext context = browser.newContext(new Browser.NewContextOptions()
            .setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
            .setViewportSize(1920, 1080)
            .setLocale("en-US"))) {
      try (InputStream is = getClass().getResourceAsStream("/stealth.js")) {
        context.addInitScript(new String(is.readAllBytes(), StandardCharsets.UTF_8));
      } catch (IOException e) {
        throw new RuntimeException("Failed to load stealth script", e);
      }
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

      try {
        page.navigate(configuration.getApiUri() + "/athlete/fitness");

        page.waitForLoadState(LoadState.NETWORKIDLE);

        page.waitForTimeout(3000);

        page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Accept All"))
            .click();
        log.info("Accepted cookies");

        page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Log In")).waitFor();

        log.info("Waiting for login form");

        page.waitForTimeout(3000);

        page.getByRole(AriaRole.TEXTBOX, new Page.GetByRoleOptions().setName("Email"))
            .fill(configuration.getUsername());

        page.waitForTimeout(1000);

        page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Log In"))
            .click();
        page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Use password instead"))
            .click();

        page.waitForTimeout(1000);

        page.getByRole(AriaRole.TEXTBOX, new Page.GetByRoleOptions().setName("Password"))
            .fill(configuration.getPassword());

        page.waitForTimeout(1000);

        page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Log In"))
            .click();

        log.info("Waiting for fitness data to load");
        page.waitForSelector(".fitness-dot");
        log.info("Successful login");
      } catch (Exception e) {
        log.error("Playwright error during fitness scraping", e);
        if (environment.matchesProfiles("local")) {
          try {
            Path screenshotPath = Path.of("playwright-error.png");
            page.screenshot(new Page.ScreenshotOptions().setPath(screenshotPath).setFullPage(true));
            log.error("Screenshot saved to {}", screenshotPath.toAbsolutePath());
          } catch (Exception screenshotError) {
            log.error("Failed to capture screenshot", screenshotError);
          }
        }
        try {
          String ariaSnapshot = page.locator("body").ariaSnapshot();
          log.error("Accessibility tree:\n{}", ariaSnapshot);
        } catch (Exception snapshotError) {
          log.error("Failed to capture accessibility tree", snapshotError);
        }
        return Optional.empty();
      }

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
