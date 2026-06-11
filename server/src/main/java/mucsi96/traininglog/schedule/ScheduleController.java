package mucsi96.traininglog.schedule;

import java.io.IOException;
import java.time.ZoneId;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.PlanWeekRequest;
import mucsi96.traininglog.api.WeekMeetings;
import mucsi96.traininglog.api.WeekSchedule;

@RestController
@RequestMapping(value = "/schedule", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class ScheduleController {

  private static final Set<String> SUPPORTED_IMAGE_TYPES = Set.of(
      MediaType.IMAGE_JPEG_VALUE, MediaType.IMAGE_PNG_VALUE, MediaType.IMAGE_GIF_VALUE, "image/webp");

  private final ScheduleService scheduleService;

  @PostMapping(value = "/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  WeekMeetings extract(@RequestParam("photo") MultipartFile photo,
      @RequestHeader("X-Timezone") ZoneId zoneId) throws IOException {
    if (photo.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Photo is required");
    }
    String mediaType = photo.getContentType();
    if (mediaType == null || !SUPPORTED_IMAGE_TYPES.contains(mediaType)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported image type");
    }
    return scheduleService.extractWeek(photo.getBytes(), mediaType, zoneId);
  }

  @PostMapping(value = "/plan", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  WeekSchedule plan(@Valid @RequestBody PlanWeekRequest request, @RequestHeader("X-Timezone") ZoneId zoneId) {
    return scheduleService.planWeek(request, zoneId);
  }

  @GetMapping
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  ResponseEntity<WeekSchedule> getWeek(@RequestHeader("X-Timezone") ZoneId zoneId) {
    return scheduleService.getWeek(zoneId)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.noContent().build());
  }
}
