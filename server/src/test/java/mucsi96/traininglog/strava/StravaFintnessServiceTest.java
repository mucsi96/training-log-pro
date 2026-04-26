package mucsi96.traininglog.strava;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.microsoft.playwright.Browser;

import mucsi96.traininglog.fitness.Fitness;
import mucsi96.traininglog.fitness.FitnessRepository;
import mucsi96.traininglog.rides.Ride;

@ExtendWith(MockitoExtension.class)
class StravaFintnessServiceTest {

  private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");
  private static final Instant NOON_UTC = Instant.parse("2026-04-26T10:00:00Z");

  @Mock
  private Browser browser;

  @Mock
  private FitnessRepository fitnessRepository;

  private StravaConfiguration configuration;
  private Clock clock;
  private StravaFintnessService service;

  @BeforeEach
  void setUp() {
    configuration = new StravaConfiguration();
    clock = Clock.fixed(NOON_UTC, ZoneOffset.UTC);
    service = spy(new StravaFintnessService(browser, configuration, fitnessRepository, clock));
  }

  private Fitness fitnessAt(ZonedDateTime createdAt) {
    return Fitness.builder()
        .createdAt(createdAt)
        .fitness(45.2f)
        .fatigue(52.1f)
        .form(-6.9f)
        .build();
  }

  private Ride rideAt(ZonedDateTime createdAt) {
    return Ride.builder()
        .createdAt(createdAt)
        .name("Morning ride")
        .build();
  }

  @Test
  void pullsAndPersistsFitness_whenNoFitnessRecordExists() {
    Fitness pulled = fitnessAt(ZonedDateTime.now(clock));
    doReturn(Optional.empty()).when(fitnessRepository).findFirstByOrderByCreatedAtDesc();
    doReturn(Optional.of(pulled)).when(service).getFitnessLevel();

    Optional<Fitness> result = service.syncFitness(List.of(), BUDAPEST);

    assertThat(result).contains(pulled);
    verify(service).getFitnessLevel();
    verify(fitnessRepository).save(pulled);
  }

  @Test
  void pullsAndPersistsFitness_whenLastPullWasBeforeToday() {
    ZonedDateTime yesterday = ZonedDateTime.now(clock).minusDays(1);
    Fitness stale = fitnessAt(yesterday);
    Fitness fresh = fitnessAt(ZonedDateTime.now(clock));
    doReturn(Optional.of(stale)).when(fitnessRepository).findFirstByOrderByCreatedAtDesc();
    doReturn(Optional.of(fresh)).when(service).getFitnessLevel();

    Optional<Fitness> result = service.syncFitness(List.of(), BUDAPEST);

    assertThat(result).contains(fresh);
    verify(service).getFitnessLevel();
    verify(fitnessRepository).save(fresh);
  }

  @Test
  void skipsPull_whenAlreadyPulledTodayAndNoNewActivities() {
    ZonedDateTime startOfToday = ZonedDateTime.now(clock).withZoneSameInstant(BUDAPEST)
        .truncatedTo(ChronoUnit.DAYS);
    Fitness today = fitnessAt(startOfToday.plusHours(3));
    Ride earlierRide = rideAt(startOfToday.plusHours(1));
    doReturn(Optional.of(today)).when(fitnessRepository).findFirstByOrderByCreatedAtDesc();

    Optional<Fitness> result = service.syncFitness(List.of(earlierRide), BUDAPEST);

    assertThat(result).isEmpty();
    verify(service, never()).getFitnessLevel();
    verify(fitnessRepository, never()).save(any());
  }

  @Test
  void pullsAndPersistsFitness_whenNewActivityArrivedAfterLastPull() {
    ZonedDateTime startOfToday = ZonedDateTime.now(clock).withZoneSameInstant(BUDAPEST)
        .truncatedTo(ChronoUnit.DAYS);
    ZonedDateTime lastPullAt = startOfToday.plusHours(3);
    Fitness staleToday = fitnessAt(lastPullAt);
    Ride newRide = rideAt(lastPullAt.plusMinutes(30));
    Fitness fresh = fitnessAt(ZonedDateTime.now(clock));

    doReturn(Optional.of(staleToday)).when(fitnessRepository).findFirstByOrderByCreatedAtDesc();
    doReturn(Optional.of(fresh)).when(service).getFitnessLevel();

    Optional<Fitness> result = service.syncFitness(List.of(newRide), BUDAPEST);

    assertThat(result).contains(fresh);
    verify(service).getFitnessLevel();
    verify(fitnessRepository).save(fresh);
  }

  @Test
  void doesNotPersist_whenStravaReturnsNoFitness() {
    doReturn(Optional.empty()).when(fitnessRepository).findFirstByOrderByCreatedAtDesc();
    doReturn(Optional.empty()).when(service).getFitnessLevel();

    Optional<Fitness> result = service.syncFitness(List.of(), BUDAPEST);

    assertThat(result).isEmpty();
    verify(service).getFitnessLevel();
    verify(fitnessRepository, never()).save(any());
  }

  @Test
  void parsesTodayProfileFromStravaResponse() {
    OffsetDateTime today = OffsetDateTime.now(ZoneOffset.UTC);
    String body = """
        [
          {
            "data": [
              {
                "date": { "year": %d, "month": %d, "day": %d },
                "fitness_profile": {
                  "fitness": 45.2,
                  "impulse": 12.3,
                  "relative_effort": 85.0,
                  "fatigue": 52.1,
                  "form": -6.9
                },
                "activities": []
              }
            ],
            "reference": {}
          }
        ]
        """.formatted(today.getYear(), today.getMonthValue(), today.getDayOfMonth());

    Optional<StravaFitnessProfile> profile = StravaFintnessService.getTodayFitnessProfile(body);

    assertThat(profile).isPresent();
    assertThat(profile.get().getFitness()).isEqualTo(45.2f);
    assertThat(profile.get().getFatigue()).isEqualTo(52.1f);
    assertThat(profile.get().getForm()).isEqualTo(-6.9f);
  }

  @Test
  void returnsEmpty_whenNoEntryForToday() {
    String body = """
        [
          {
            "data": [
              {
                "date": { "year": 1999, "month": 1, "day": 1 },
                "fitness_profile": {
                  "fitness": 1.0,
                  "impulse": 1.0,
                  "relative_effort": 1.0,
                  "fatigue": 1.0,
                  "form": 1.0
                },
                "activities": []
              }
            ],
            "reference": {}
          }
        ]
        """;

    Optional<StravaFitnessProfile> profile = StravaFintnessService.getTodayFitnessProfile(body);

    assertThat(profile).isEmpty();
  }

  @Test
  void returnsEmpty_whenResponseIsNotValidJson() {
    Optional<StravaFitnessProfile> profile = StravaFintnessService.getTodayFitnessProfile("not-json");

    assertThat(profile).isEmpty();
  }
}
