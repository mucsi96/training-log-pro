package mucsi96.traininglog.withings;

import java.time.ZoneId;
import java.util.Map;

import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.security.oauth2.core.endpoint.OAuth2AccessTokenResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationExchange;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationResponse;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import org.springframework.web.servlet.view.RedirectView;
import org.springframework.web.util.UriComponentsBuilder;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.core.AuthTokenService;
import mucsi96.traininglog.weight.WeightService;

@RestController
@RequestMapping("/withings")
@RequiredArgsConstructor
@Slf4j
public class WithingsController {

  private static final String TEST_PRINCIPAL = "rob";

  private final WithingsService withingsService;
  private final WeightService weightService;
  private final OAuth2AuthorizedClientManager withingsAuthorizedClientManager;
  private final AuthTokenService authTokenService;
  private final ClientRegistrationRepository clientRegistrationRepository;
  private final OAuth2AuthorizedClientRepository authorizedClientRepository;
  private final WithingsConfiguration withingsConfiguration;
  private final Environment environment;

  @PostMapping("/auth-token")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  public Map<String, String> createAuthToken(Authentication principal) {
    String token = authTokenService.generateToken(principal.getName());
    return Map.of("token", token);
  }

  @PostMapping("/sync")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  public ResponseEntity<?> sync(
      Authentication principal,
      HttpServletRequest servletRequest,
      HttpServletResponse servletResponse,
      @RequestHeader("X-Timezone") ZoneId zoneId) {

    log.info("syncing from Withings");

    try {
      OAuth2AuthorizedClient authorizedClient = getAuthorizedClient(principal, servletRequest, servletResponse);
      withingsService.getTodayWeight(authorizedClient, zoneId).ifPresent(weightService::saveWeight);
    } catch (OAuth2AuthorizationException ex) {
      String authorizeUrl = ServletUriComponentsBuilder.fromRequestUri(servletRequest)
          .replacePath(servletRequest.getContextPath() + "/withings/authorize").toUriString();
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(Map.of("_links", Map.of("oauth2Login", Map.of("href", authorizeUrl))));
    }

    return ResponseEntity.ok().build();
  }

  @GetMapping("/authorize")
  public RedirectView authorize(
      @RequestParam(name = "auth_token", required = false) String authToken,
      @RequestParam(name = "code", required = false) String code,
      @RequestParam(name = "state", required = false) String state,
      HttpServletRequest servletRequest,
      HttpServletResponse servletResponse) {

    if (code != null && state != null) {
      return handleCallback(code, state, servletRequest, servletResponse);
    }

    String principalName = resolvePrincipalName(authToken);
    return initiateAuthorization(principalName, servletRequest);
  }

  private String resolvePrincipalName(String authToken) {
    if (authToken != null) {
      String principalName = authTokenService.validateAndConsume(authToken);
      if (principalName != null) {
        return principalName;
      }
    }
    if (environment.matchesProfiles("test")) {
      return TEST_PRINCIPAL;
    }
    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired auth token");
  }

  private RedirectView initiateAuthorization(String principalName, HttpServletRequest request) {
    ClientRegistration registration = clientRegistrationRepository
        .findByRegistrationId(WithingsConfiguration.registrationId);
    String redirectUri = buildRedirectUri(request);
    String stateValue = authTokenService.generateToken(principalName);

    String authUrl = UriComponentsBuilder
        .fromUriString(registration.getProviderDetails().getAuthorizationUri())
        .queryParam("client_id", registration.getClientId())
        .queryParam("redirect_uri", redirectUri)
        .queryParam("response_type", "code")
        .queryParam("scope", String.join(" ", registration.getScopes()))
        .queryParam("state", stateValue)
        .build().toUriString();

    log.info("Redirecting to Withings authorization: {}", authUrl);
    return new RedirectView(authUrl);
  }

  private RedirectView handleCallback(String code, String state,
      HttpServletRequest request, HttpServletResponse response) {
    String principalName = authTokenService.validateAndConsume(state);
    if (principalName == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired state");
    }

    ClientRegistration registration = clientRegistrationRepository
        .findByRegistrationId(WithingsConfiguration.registrationId);
    String redirectUri = buildRedirectUri(request);

    OAuth2AuthorizationRequest authRequest = OAuth2AuthorizationRequest.authorizationCode()
        .clientId(registration.getClientId())
        .authorizationUri(registration.getProviderDetails().getAuthorizationUri())
        .redirectUri(redirectUri)
        .scopes(registration.getScopes())
        .state(state)
        .build();

    OAuth2AuthorizationResponse authResponse = OAuth2AuthorizationResponse.success(code)
        .redirectUri(redirectUri)
        .state(state)
        .build();

    OAuth2AuthorizationExchange exchange = new OAuth2AuthorizationExchange(authRequest, authResponse);
    var grantRequest = new org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest(
        registration, exchange);

    OAuth2AccessTokenResponse tokenResponse = withingsConfiguration
        .withingsAccessTokenResponseClient().getTokenResponse(grantRequest);

    OAuth2AuthorizedClient authorizedClient = new OAuth2AuthorizedClient(
        registration, principalName, tokenResponse.getAccessToken(), tokenResponse.getRefreshToken());

    Authentication auth = new PreAuthenticatedAuthenticationToken(principalName, null);
    authorizedClientRepository.saveAuthorizedClient(authorizedClient, auth, request, response);

    log.info("Successful Withings authorization for principal: {}", principalName);
    return new RedirectView("/");
  }

  private String buildRedirectUri(HttpServletRequest request) {
    return ServletUriComponentsBuilder.fromRequest(request)
        .replacePath(request.getContextPath() + "/withings/authorize")
        .replaceQuery(null)
        .build().toUriString();
  }

  private OAuth2AuthorizedClient getAuthorizedClient(Authentication principal, HttpServletRequest servletRequest,
      HttpServletResponse servletResponse) {
    OAuth2AuthorizeRequest authorizeRequest = OAuth2AuthorizeRequest
        .withClientRegistrationId(WithingsConfiguration.registrationId)
        .principal(principal)
        .attribute(HttpServletRequest.class.getName(), servletRequest)
        .attribute(HttpServletResponse.class.getName(), servletResponse)
        .build();
    OAuth2AuthorizedClient authorizedClient = withingsAuthorizedClientManager.authorize(authorizeRequest);
    log.info("Successful Withings authorization");
    return authorizedClient;
  }
}
