package mucsi96.traininglog.schedule;

import java.io.IOException;
import java.time.ZoneId;

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

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.DaySchedule;
import mucsi96.traininglog.api.ExtractedMeetings;
import mucsi96.traininglog.api.PlanRequest;

@RestController
@RequestMapping(value = "/schedule", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class ScheduleController {

  private final ScheduleService scheduleService;

  @PostMapping(value = "/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  ExtractedMeetings extract(@RequestParam("photo") MultipartFile photo) throws IOException {
    if (photo.isEmpty()) {
      throw new IllegalArgumentException("Photo is required");
    }
    String mediaType = photo.getContentType() == null ? MediaType.IMAGE_JPEG_VALUE : photo.getContentType();
    return scheduleService.extractMeetings(photo.getBytes(), mediaType);
  }

  @PostMapping(value = "/plan", consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  DaySchedule plan(@Valid @RequestBody PlanRequest request, @RequestHeader("X-Timezone") ZoneId zoneId) {
    return scheduleService.plan(request, zoneId);
  }

  @GetMapping
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  ResponseEntity<DaySchedule> getToday(@RequestHeader("X-Timezone") ZoneId zoneId) {
    return scheduleService.getToday(zoneId)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.noContent().build());
  }
}
