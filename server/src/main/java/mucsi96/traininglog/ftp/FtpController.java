package mucsi96.traininglog.ftp;

import java.time.ZoneId;
import java.util.Optional;

import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.FtpMeasurement;
import mucsi96.traininglog.api.FtpTimeline;

@RestController
@RequestMapping(value = "/ftp", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
public class FtpController {

  private final FtpService ftpService;

  @GetMapping
  FtpTimeline getFtp(
      @RequestParam(required = false) @Positive Integer period,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    return FtpTimeline.builder()
        .measurements(ftpService.getFtp(Optional.ofNullable(period), zoneId).stream()
            .map(row -> FtpMeasurement.builder()
                .date(row.getCreatedAt().withZoneSameInstant(zoneId).toOffsetDateTime())
                .ftp(row.getFtp())
                .weight(row.getWeight())
                .ftpPerKg(row.getFtpPerKg())
                .build())
            .toList())
        .build();
  }
}
