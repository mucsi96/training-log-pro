package mucsi96.traininglog.schedule;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.api.DaySchedule;
import mucsi96.traininglog.api.ExtractedMeetings;
import mucsi96.traininglog.api.MeetingReview;
import mucsi96.traininglog.api.PlanRequest;
import mucsi96.traininglog.api.ScheduleBlock;
import mucsi96.traininglog.settings.SettingsEntity;
import mucsi96.traininglog.settings.SettingsService;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleService {

  private static final String TRAINING_RIDE_TYPE = "training-ride";

  private final AnthropicClient anthropicClient;
  private final WeatherClient weatherClient;
  private final SettingsService settingsService;
  private final ScheduleRepository scheduleRepository;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public ExtractedMeetings extractMeetings(byte[] photo, String mediaType) {
    String prompt = """
        You are reading a photo of a work Outlook calendar for a single day.
        Extract every meeting you can see into a JSON object with this exact shape:
        {"meetings":[{"title":"...","startTime":"HH:mm","endTime":"HH:mm","location":"..."}]}
        Use 24-hour HH:mm times. If a field is unknown use an empty string.
        Respond with ONLY the JSON, no prose and no markdown fences.""";

    String output = anthropicClient.extractFromImage(prompt, photo, mediaType);
    return parse(output, ExtractedMeetings.class);
  }

  @Transactional
  public DaySchedule plan(PlanRequest request, ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    SettingsEntity settings = settingsService.getCurrent();

    List<MeetingReview> keptMeetings = request.getMeetings().stream()
        .filter(meeting -> Boolean.TRUE.equals(meeting.getAttend()))
        .toList();

    boolean goingToOffice = keptMeetings.stream()
        .anyMatch(meeting -> Boolean.TRUE.equals(meeting.getRequiresOffice()));

    String commuteMode = resolveCommuteMode(goingToOffice, settings);

    String prompt = buildPlanningPrompt(keptMeetings, commuteMode, settings);
    String output = anthropicClient.complete(prompt);
    PlanResult result = parse(output, PlanResult.class);

    List<ScheduleBlock> blocks = Optional.ofNullable(result.blocks()).orElse(List.of());
    if ("bike".equals(commuteMode)) {
      // A training ride is only planned when the commute home is not already by bike.
      blocks = blocks.stream()
          .filter(block -> !TRAINING_RIDE_TYPE.equals(block.getType()))
          .toList();
    }

    scheduleRepository.save(ScheduleEntity.builder()
        .date(today)
        .commuteMode(commuteMode)
        .blocks(blocks)
        .build());

    return DaySchedule.builder()
        .date(today.toString())
        .commuteMode(commuteMode)
        .blocks(blocks)
        .build();
  }

  @Transactional(readOnly = true)
  public Optional<DaySchedule> getToday(ZoneId zoneId) {
    LocalDate today = LocalDate.now(clock.withZone(zoneId));
    return scheduleRepository.findById(today)
        .map(entity -> DaySchedule.builder()
            .date(entity.getDate().toString())
            .commuteMode(entity.getCommuteMode())
            .blocks(entity.getBlocks())
            .build());
  }

  private String resolveCommuteMode(boolean goingToOffice, SettingsEntity settings) {
    if (!goingToOffice) {
      return "none";
    }
    if (settings.getHomeLat() == null || settings.getHomeLng() == null) {
      throw new IllegalStateException("Home location must be configured to plan an office commute");
    }
    WeatherForecast forecast = weatherClient.getTodayForecast(settings.getHomeLat(), settings.getHomeLng());
    double threshold = settings.getRainThresholdMm() == null ? 1.0 : settings.getRainThresholdMm();
    return forecast.maxPrecipitationMm() > threshold ? "car" : "bike";
  }

  private String buildPlanningPrompt(List<MeetingReview> meetings, String commuteMode, SettingsEntity settings) {
    String meetingLines = meetings.isEmpty()
        ? "(no meetings to attend)"
        : meetings.stream()
            .map(meeting -> "- %s %s-%s%s".formatted(
                meeting.getTitle(),
                nullToEmpty(meeting.getStartTime()),
                nullToEmpty(meeting.getEndTime()),
                Boolean.TRUE.equals(meeting.getRequiresOffice()) ? " (at office)" : ""))
            .collect(Collectors.joining("\n"));

    return """
        You are an assistant that builds a single day's personal schedule.
        Lay out a realistic, non-overlapping timeline as a JSON object with this exact shape:
        {"blocks":[{"startTime":"HH:mm","endTime":"HH:mm","title":"...","type":"...","details":"..."}]}
        Use 24-hour HH:mm times. Respond with ONLY the JSON, no prose and no markdown fences.

        Use these block "type" values: meeting, commute, school-pickup, pomodoro, pushups,
        training-ride, german-cards, reading, german-with-wife, flashcard-creation.

        Today's commute to and from the office is by: %s
        (If the commute mode is "none" the user is working from home and there is no commute block.
        Only include a training-ride block when the user is NOT commuting home by bike.)

        Meetings to attend:
        %s

        Constraints and preferences:
        - Work hours: %s to %s
        - Office address: %s
        - Pick the son up from school at %s (address: %s); include the round trip.
        - Bike commute one way: %s minutes. Car commute one way: %s minutes.
        - Session durations (minutes): pomodoro %s, training ride %s, german cards %s,
          reading %s, german with wife %s, flashcard creation %s.
        - Daily goals to fit in: %s pushups total and at least %s reading pages.
        - Fill remaining work time with pomodoro work sessions.""".formatted(
        commuteMode,
        meetingLines,
        nullToEmpty(settings.getWorkStartTime()),
        nullToEmpty(settings.getWorkEndTime()),
        nullToEmpty(settings.getOfficeAddress()),
        nullToEmpty(settings.getSonPickupTime()),
        nullToEmpty(settings.getSchoolAddress()),
        settings.getCommuteBikeMinutes(),
        settings.getCommuteCarMinutes(),
        settings.getPomodoroMinutes(),
        settings.getTrainingRideMinutes(),
        settings.getGermanCardsMinutes(),
        settings.getReadingMinutes(),
        settings.getGermanWithWifeMinutes(),
        settings.getFlashcardCreationMinutes(),
        settings.getPushupGoal(),
        settings.getReadingPagesGoal());
  }

  private <T> T parse(String output, Class<T> type) {
    try {
      return objectMapper.readValue(stripFences(output), type);
    } catch (Exception e) {
      log.error("Failed to parse AI response: {}", output);
      throw new IllegalStateException("Could not parse AI response", e);
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

  private record PlanResult(List<ScheduleBlock> blocks) {
  }
}
