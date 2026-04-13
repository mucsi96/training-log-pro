package mucsi96.traininglog.strava;

import java.time.ZoneId;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.view.RedirectView;

import org.springframework.security.access.prepost.PreAuthorize;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.rides.RideService;

@RestController
@RequestMapping("/strava")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
@Slf4j
public class StravaController {

  private final StravaActivityService stravaActivityService;
  private final RideService rideService;
  private final OAuth2AuthorizedClientManager stravaAuthorizedClientManager;

  @PostMapping("/activities/sync")
  public ResponseEntity<?> syncActivities(
      Authentication principal,
      HttpServletRequest servletRequest,
      HttpServletResponse servletResponse,
      @RequestHeader("X-Timezone") ZoneId zoneId) {

    log.info("syncing from Strava");

    try {
      OAuth2AuthorizedClient authorizedClient = getAuthorizedClient(principal, servletRequest, servletResponse);
      stravaActivityService.getTodayRides(authorizedClient, zoneId).forEach(rideService::saveRide);
    } catch (OAuth2AuthorizationException ex) {
      String authorizeUrl = ServletUriComponentsBuilder.fromRequestUri(servletRequest)
          .replacePath("/strava/authorize").toUriString();
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("_links", Map.of("oauth2Login", Map.of("href", authorizeUrl))));
    }

    return ResponseEntity.ok().build();
  }

  @GetMapping("/authorize")
  public RedirectView authorize(
      Authentication principal,
      HttpServletRequest servletRequest,
      HttpServletResponse servletResponse) {
    log.info("authorizing Strava client");
    getAuthorizedClient(principal, servletRequest, servletResponse);
    return new RedirectView("/");
  }

  private OAuth2AuthorizedClient getAuthorizedClient(Authentication principal, HttpServletRequest servletRequest,
      HttpServletResponse servletResponse) {
    OAuth2AuthorizeRequest authorizeRequest = OAuth2AuthorizeRequest
        .withClientRegistrationId(StravaConfiguration.registrationId)
        .principal(principal)
        .attribute(HttpServletRequest.class.getName(), servletRequest)
        .attribute(HttpServletResponse.class.getName(), servletResponse)
        .build();
    OAuth2AuthorizedClient authorizedClient = stravaAuthorizedClientManager.authorize(authorizeRequest);
    log.info("Successful Strava authorization");
    return authorizedClient;
  }
}
