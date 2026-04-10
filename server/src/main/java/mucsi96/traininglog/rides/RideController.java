package mucsi96.traininglog.rides;

import java.time.ZoneId;
import java.util.Optional;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.RideStats;

@RestController
@RequestMapping(value = "/ride", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@RolesAllowed("user")
public class RideController {

  private final RideService rideService;

  @GetMapping("/stats")
  RideStats activity(
      @RequestParam(required = false) @Positive Integer period,
      @RequestHeader("X-Timezone") ZoneId zoneId) {
    return rideService.getStats(Optional.ofNullable(period), zoneId);
  }
}
