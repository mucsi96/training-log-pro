package mucsi96.traininglog.withings;

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
import mucsi96.traininglog.weight.WeightService;

@RestController
@RequestMapping("/withings")
@RequiredArgsConstructor
@Slf4j
public class WithingsController {

  private static final String PRINCIPAL_NAME = "training-log-user";

  private final WithingsService withingsService;
  private final WeightService weightService;
  private final OAuth2AuthorizedClientManager withingsAuthorizedClientManager;
  private final AuthorizeTokenService authorizeTokenService;

  @PostMapping("/sync")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  public ResponseEntity<?> sync(
      HttpServletRequest servletRequest,
      HttpServletResponse servletResponse,
      @RequestHeader("X-Timezone") ZoneId zoneId) {

    log.info("syncing from Withings");

    try {
      OAuth2AuthorizedClient authorizedClient = getAuthorizedClient(servletRequest, servletResponse);
      withingsService.getTodayWeight(authorizedClient, zoneId).ifPresent(weightService::saveWeight);
    } catch (OAuth2AuthorizationException ex) {
      String authorizeUrl = ServletUriComponentsBuilder.fromRequestUri(servletRequest)
          .replacePath("/withings/authorize").toUriString();
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
    log.info("authorizing Withings client");
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
        .withClientRegistrationId(WithingsConfiguration.registrationId)
        .principal(PRINCIPAL_NAME)
        .attribute(HttpServletRequest.class.getName(), servletRequest)
        .attribute(HttpServletResponse.class.getName(), servletResponse)
        .build();
    OAuth2AuthorizedClient authorizedClient = withingsAuthorizedClientManager.authorize(authorizeRequest);
    log.info("Successful Withings authorization");
    return authorizedClient;
  }
}
