package mucsi96.traininglog.strava;

import java.time.ZoneId;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.view.RedirectView;

import org.springframework.security.access.prepost.PreAuthorize;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.core.AuthorizeTokenService;
import mucsi96.traininglog.rides.RideService;

@RestController
@RequestMapping("/strava")
@RequiredArgsConstructor
@Slf4j
public class StravaController {

  private static final String PRINCIPAL_NAME = "training-log-user";

  private final StravaActivityService stravaActivityService;
  private final RideService rideService;
  private final OAuth2AuthorizedClientManager stravaAuthorizedClientManager;
  private final AuthorizeTokenService authorizeTokenService;

  @PostMapping("/activities/sync")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  public ResponseEntity<?> syncActivities(
      HttpServletRequest servletRequest,
      HttpServletResponse servletResponse,
      @RequestHeader("X-Timezone") ZoneId zoneId) {

    log.info("syncing from Strava");

    try {
      OAuth2AuthorizedClient authorizedClient = getAuthorizedClient(servletRequest, servletResponse);
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
      @RequestParam(required = false) String token,
      HttpServletRequest servletRequest,
      HttpServletResponse servletResponse) {
    log.info("authorizing Strava client");
    try {
      getAuthorizedClient(servletRequest, servletResponse);
      return new RedirectView("/");
    } catch (OAuth2AuthorizationException ex) {
      if (token == null || !authorizeTokenService.validateToken(token)) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
      }
      throw ex;
    }
  }

  private OAuth2AuthorizedClient getAuthorizedClient(HttpServletRequest servletRequest,
      HttpServletResponse servletResponse) {
    OAuth2AuthorizeRequest authorizeRequest = OAuth2AuthorizeRequest
        .withClientRegistrationId(StravaConfiguration.registrationId)
        .principal(PRINCIPAL_NAME)
        .attribute(HttpServletRequest.class.getName(), servletRequest)
        .attribute(HttpServletResponse.class.getName(), servletResponse)
        .build();
    OAuth2AuthorizedClient authorizedClient = stravaAuthorizedClientManager.authorize(authorizeRequest);
    log.info("Successful Strava authorization");
    return authorizedClient;
  }
}
