package mucsi96.traininglog.schedule;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.activity.ActivityEntity;
import mucsi96.traininglog.activity.ActivityService;
import mucsi96.traininglog.api.DaySchedule;
import mucsi96.traininglog.api.MeetingReview;
import mucsi96.traininglog.api.PlanWeekRequest;
import mucsi96.traininglog.api.ScheduleBlock;
import mucsi96.traininglog.api.WeekMeetings;
import mucsi96.traininglog.api.WeekSchedule;
import mucsi96.traininglog.location.LocationEntity;
import mucsi96.traininglog.location.LocationService;
import mucsi96.traininglog.settings.SettingsEntity;
import mucsi96.traininglog.settings.SettingsService;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleService {

  private final AnthropicClient anthropicClient;
  private final WeatherClient weatherClient;
  private final SettingsService settingsService;
  private final ActivityService activityService;
  private final LocationService locationService;
  private final WeekPlanRepository weekPlanRepository;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public WeekMeetings extractWeek(byte[] photo, String mediaType, ZoneId zoneId) {
    LocalDate weekStart = weekStart(zoneId);
    LocalDate weekEnd = weekStart.plusDays(6);
    String prompt = """
        You are reading a photo of an Outlook work calendar shown in week view.
        Extract every meeting into a JSON object with this exact shape:
        {"meetings":[{"date":"YYYY-MM-DD","title":"...","startTime":"HH:mm","endTime":"HH:mm","location":"..."}]}
        The week runs from %s (Monday) to %s (Sunday); every meeting date must fall in that range.
        Use 24-hour HH:mm times. If a field is unknown use an empty string.
        Respond with ONLY the JSON, no prose and no markdown fences."""
        .formatted(weekStart, weekEnd);

    String output = anthropicClient.extractFromImage(prompt, photo, mediaType);
    return parse(output, WeekMeetings.class);
  }

  // Deliberately not @Transactional: the Anthropic and weather HTTP calls can
  // take seconds and must not hold a DB transaction open. Each repository call
  // runs in its own short transaction.
  public WeekSchedule planWeek(PlanWeekRequest request, ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    LocalDate weekStart = weekStart(zoneId);
    LocalDate weekEnd = weekStart.plusDays(6);
    LocalDate planStart = today.isBefore(weekStart) ? weekStart : today;

    List<LocalDate> planningDays = planStart.datesUntil(weekEnd.plusDays(1)).toList();

    if (request.getMeetings() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "meetings is required");
    }

    Map<LocalDate, List<MeetingReview>> keptByDate = request.getMeetings().stream()
        .filter(meeting -> Boolean.TRUE.equals(meeting.getAttend()))
        .filter(meeting -> meeting.getDate() != null && !meeting.getDate().isBlank())
        .collect(Collectors.groupingBy(meeting -> parseDate(meeting.getDate())));

    SettingsEntity settings = settingsService.getCurrent();
    List<ActivityEntity> activities = activityService.list();
    List<LocationEntity> locations = locationService.list();
    Optional<LocationEntity> home = locations.stream().filter(LocationEntity::isHome).findFirst();

    Map<LocalDate, Double> precipitation = home
        .filter(h -> h.getLatitude() != null && h.getLongitude() != null)
        .map(h -> weatherClient.getDailyPrecipitation(h.getLatitude(), h.getLongitude()))
        .orElseGet(Map::of);

    double threshold = settings.getRainThresholdMm() == null ? 1.0 : settings.getRainThresholdMm();

    Map<LocalDate, String> commuteByDate = planningDays.stream().collect(Collectors.toMap(
        day -> day,
        day -> {
          boolean office = keptByDate.getOrDefault(day, List.of()).stream()
              .anyMatch(meeting -> Boolean.TRUE.equals(meeting.getRequiresOffice()));
          if (!office) {
            return "none";
          }
          return precipitation.getOrDefault(day, 0d) > threshold ? "car" : "bike";
        }));

    String prompt = buildWeekPrompt(planningDays, keptByDate, commuteByDate, activities, locations, settings);
    String output = anthropicClient.complete(prompt);
    PlanResult result = parse(output, PlanResult.class);

    Map<LocalDate, List<ScheduleBlock>> blocksByDate = Optional.ofNullable(result.days()).orElse(List.of()).stream()
        .filter(day -> day.getDate() != null && !day.getDate().isBlank())
        .collect(Collectors.toMap(
            day -> LocalDate.parse(day.getDate()),
            day -> Optional.ofNullable(day.getBlocks()).orElse(List.of()),
            (a, b) -> a));

    List<DaySchedule> plannedDays = planningDays.stream()
        .map(day -> DaySchedule.builder()
            .date(day.toString())
            .commuteMode(commuteByDate.get(day))
            .blocks(blocksByDate.getOrDefault(day, List.of()))
            .build())
        .toList();

    List<DaySchedule> pastDays = weekPlanRepository.findById(weekStart)
        .map(WeekPlanEntity::getDays)
        .orElseGet(List::of).stream()
        .filter(day -> LocalDate.parse(day.getDate()).isBefore(planStart))
        .toList();

    List<DaySchedule> merged = new ArrayList<>(pastDays);
    merged.addAll(plannedDays);
    merged.sort(Comparator.comparing(DaySchedule::getDate));

    weekPlanRepository.save(WeekPlanEntity.builder()
        .weekStart(weekStart)
        .meetings(request.getMeetings())
        .days(merged)
        .updatedAt(now())
        .build());

    return WeekSchedule.builder().weekStart(weekStart.toString()).days(merged).build();
  }

  @Transactional(readOnly = true)
  public Optional<WeekSchedule> getWeek(ZoneId zoneId) {
    LocalDate weekStart = weekStart(zoneId);
    return weekPlanRepository.findById(weekStart)
        .map(entity -> WeekSchedule.builder()
            .weekStart(weekStart.toString())
            .days(entity.getDays())
            .build());
  }

  private LocalDate weekStart(ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    return today.minusDays(today.getDayOfWeek().getValue() - 1L);
  }

  private LocalDate parseDate(String value) {
    try {
      return LocalDate.parse(value);
    } catch (DateTimeParseException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid meeting date: " + value);
    }
  }

  private ZonedDateTime now() {
    return ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
  }

  private String buildWeekPrompt(
      List<LocalDate> planningDays,
      Map<LocalDate, List<MeetingReview>> keptByDate,
      Map<LocalDate, String> commuteByDate,
      List<ActivityEntity> activities,
      List<LocationEntity> locations,
      SettingsEntity settings) {

    String dayLines = planningDays.stream().map(day -> {
      String meetings = keptByDate.getOrDefault(day, List.of()).stream()
          .map(meeting -> "    * %s %s-%s%s".formatted(
              meeting.getTitle(),
              nullToEmpty(meeting.getStartTime()),
              nullToEmpty(meeting.getEndTime()),
              Boolean.TRUE.equals(meeting.getRequiresOffice()) ? " (office)" : ""))
          .collect(Collectors.joining("\n"));
      return "  - %s (%s), commute: %s%s".formatted(
          day, day.getDayOfWeek(), commuteByDate.get(day),
          meetings.isEmpty() ? ", no meetings" : "\n" + meetings);
    }).collect(Collectors.joining("\n"));

    String activityLines = activities.isEmpty()
        ? "  (none configured)"
        : activities.stream().map(activity -> "  - %s: %d min, %d/week%s%s%s%s%s".formatted(
            activity.getName(),
            activity.getDurationMinutes(),
            activity.getOccurrencesPerWeek(),
            activity.getLocationId() != null ? ", location " + locationName(locations, activity.getLocationId()) : "",
            timeWindow(activity.getEarliestTime(), activity.getLatestTime()),
            isBlank(activity.getDaysOfWeek()) ? "" : ", days " + activity.getDaysOfWeek(),
            activity.getPriority() != null ? ", priority " + activity.getPriority() : "",
            isBlank(activity.getConstraintNote()) ? "" : ", rule: " + activity.getConstraintNote()))
            .collect(Collectors.joining("\n"));

    String locationLines = locations.isEmpty()
        ? "  (none configured)"
        : locations.stream().map(location -> "  - %s%s%s%s".formatted(
            location.getName(),
            location.isHome() ? " (home)" : "",
            location.getAddress() != null ? " @ " + location.getAddress() : "",
            travelFromHome(location)))
            .collect(Collectors.joining("\n"));

    return """
        You are planning a person's week, one day at a time, around fixed meetings.
        Return a JSON object with this exact shape, covering EXACTLY these dates:
        {"days":[{"date":"YYYY-MM-DD","commuteMode":"bike|car|none","blocks":[{"startTime":"HH:mm","endTime":"HH:mm","title":"...","type":"...","details":"..."}]}]}
        Use 24-hour HH:mm times and non-overlapping blocks. Respond with ONLY the JSON, no prose, no markdown fences.

        For each day the commute mode is already decided (see below) — use it as given. On office days
        add commute blocks home<->office using the office location's bike/car minutes. Distribute each
        activity's weekly occurrences across the days, honouring its location, time window, allowed days,
        priority and free-text rule. Fit flexible work as needed within work hours %s-%s.

        Days to plan:
        %s

        Activities (recurring, schedule these across the week):
        %s

        Locations:
        %s"""
        .formatted(
            nullToEmpty(settings.getWorkStartTime()),
            nullToEmpty(settings.getWorkEndTime()),
            dayLines,
            activityLines,
            locationLines);
  }

  private String travelFromHome(LocationEntity location) {
    List<String> parts = new ArrayList<>();
    if (location.getBikeMinutesFromHome() != null) {
      parts.add("bike " + location.getBikeMinutesFromHome() + " min");
    }
    if (location.getCarMinutesFromHome() != null) {
      parts.add("car " + location.getCarMinutesFromHome() + " min");
    }
    return parts.isEmpty() ? "" : " [" + String.join(", ", parts) + " from home]";
  }

  private String timeWindow(String earliest, String latest) {
    boolean hasEarliest = !isBlank(earliest);
    boolean hasLatest = !isBlank(latest);
    if (hasEarliest && hasLatest) {
      return ", between " + earliest + " and " + latest;
    }
    if (hasEarliest) {
      return ", from " + earliest;
    }
    if (hasLatest) {
      return ", until " + latest;
    }
    return "";
  }

  private boolean isBlank(String value) {
    return value == null || value.isBlank();
  }

  private String locationName(List<LocationEntity> locations, java.util.UUID id) {
    return locations.stream()
        .filter(location -> location.getId().equals(id))
        .map(LocationEntity::getName)
        .findFirst()
        .orElse("unknown");
  }

  private <T> T parse(String output, Class<T> type) {
    try {
      return objectMapper.readValue(stripFences(output), type);
    } catch (Exception e) {
      String preview = output == null ? "" : output.substring(0, Math.min(200, output.length()));
      log.error("Failed to parse AI response (first 200 chars): {}", preview);
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not parse AI response", e);
    }
  }

  private String stripFences(String output) {
    String trimmed = output.strip();
    if (trimmed.startsWith("```")) {
      int firstNewline = trimmed.indexOf('\n');
      if (firstNewline >= 0) {
        trimmed = trimmed.substring(firstNewline + 1);
      }
      if (trimmed.endsWith("```")) {
        trimmed = trimmed.substring(0, trimmed.length() - 3);
      }
    }
    return trimmed.strip();
  }

  private String nullToEmpty(String value) {
    return value == null ? "" : value;
  }

  private record PlanResult(List<DaySchedule> days) {
  }
}
