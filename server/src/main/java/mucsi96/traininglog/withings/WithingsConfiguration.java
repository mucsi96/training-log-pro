package mucsi96.traininglog.withings;

import java.util.Map;
import java.util.Set;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.client.JdbcOAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProvider;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientProviderBuilder;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.RemoveAuthorizedClientOAuth2AuthorizationFailureHandler;
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest;
import org.springframework.security.oauth2.client.endpoint.OAuth2RefreshTokenGrantRequest;
import org.springframework.security.oauth2.client.endpoint.RestClientAuthorizationCodeTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.RestClientRefreshTokenTokenResponseClient;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthorizationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.endpoint.OAuth2AccessTokenResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.core.http.converter.OAuth2AccessTokenResponseHttpMessageConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.security.web.authentication.preauth.AbstractPreAuthenticatedProcessingFilter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.core.OneTimeTokenBridgeFilter;
import mucsi96.traininglog.core.TokenService;

@Data
@Configuration
@ConfigurationProperties(prefix = "withings")
@Slf4j
public class WithingsConfiguration {
  public static final String registrationId = "withings-client";

  private String apiUri;

  @Bean
  @Order(2)
  SecurityFilterChain withingsSecurityFilterChain(HttpSecurity http, TokenService tokenService,
      ClientRegistrationRepository clientRegistrationRepository) throws Exception {
    return http
        .securityMatcher("/withings/authorize")
        .csrf(AbstractHttpConfigurer::disable)
        .addFilterBefore(new OneTimeTokenBridgeFilter(tokenService),
            AbstractPreAuthenticatedProcessingFilter.class)
        .oauth2Client(configurer -> configurer
            .authorizationCodeGrant(customizer -> customizer
                .authorizationRequestResolver(tokenForwardingResolver(clientRegistrationRepository))
                .accessTokenResponseClient(withingsAccessTokenResponseClient())))
        .authorizeHttpRequests(authorize -> authorize.anyRequest().authenticated())
        .build();
  }

  private OAuth2AuthorizationRequestResolver tokenForwardingResolver(
      ClientRegistrationRepository clientRegistrationRepository) {
    DefaultOAuth2AuthorizationRequestResolver defaultResolver =
        new DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/oauth2/authorization");

    return new OAuth2AuthorizationRequestResolver() {
      @Override
      public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return addTokenToRedirectUri(request, defaultResolver.resolve(request));
      }

      @Override
      public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        return addTokenToRedirectUri(request, defaultResolver.resolve(request, clientRegistrationId));
      }

      private OAuth2AuthorizationRequest addTokenToRedirectUri(HttpServletRequest request,
          OAuth2AuthorizationRequest authorizationRequest) {
        if (authorizationRequest == null) {
          return null;
        }
        String token = request.getParameter("token");
        if (token == null) {
          return authorizationRequest;
        }
        String redirectUri = UriComponentsBuilder.fromUriString(authorizationRequest.getRedirectUri())
            .queryParam("token", token)
            .toUriString();
        return OAuth2AuthorizationRequest.from(authorizationRequest)
            .redirectUri(redirectUri)
            .build();
      }
    };
  }

  @Bean
  OAuth2AuthorizedClientManager withingsAuthorizedClientManager(
      ClientRegistrationRepository clientRegistrationRepository,
      OAuth2AuthorizedClientRepository authorizedClientRepository) {

    DefaultOAuth2AuthorizedClientManager authorizedClientManager = new DefaultOAuth2AuthorizedClientManager(
        clientRegistrationRepository, authorizedClientRepository);

    OAuth2AuthorizedClientProvider authorizedClientProvider = OAuth2AuthorizedClientProviderBuilder.builder()
        .authorizationCode()
        .refreshToken(configurer -> configurer.accessTokenResponseClient(withingsRefreshTokenResponseClient()))
        .build();

    authorizedClientManager.setAuthorizedClientProvider(authorizedClientProvider);

    Set<String> removeAuthorizedClientErrorCodes = Set.of(
        OAuth2ErrorCodes.INVALID_GRANT,
        OAuth2ErrorCodes.INVALID_TOKEN, "invalid_token_response");

    authorizedClientManager.setAuthorizationFailureHandler(new RemoveAuthorizedClientOAuth2AuthorizationFailureHandler(
        (clientRegistrationId, principal, attributes) -> authorizedClientRepository.removeAuthorizedClient(
            clientRegistrationId, principal,
            (HttpServletRequest) attributes.get(HttpServletRequest.class.getName()),
            (HttpServletResponse) attributes.get(HttpServletResponse.class.getName())),
        removeAuthorizedClientErrorCodes));

    return authorizedClientManager;
  }

  @Bean
  OAuth2AuthorizedClientService authorizedClientService(
      JdbcTemplate jdbcTemplate,
      ClientRegistrationRepository clientRegistrationRepository) {
    return new JdbcOAuth2AuthorizedClientService(jdbcTemplate, clientRegistrationRepository);
  }

  OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> withingsAccessTokenResponseClient() {
    RestClientAuthorizationCodeTokenResponseClient client = new RestClientAuthorizationCodeTokenResponseClient();
    client.setParametersConverter(withingsAccessTokenRequestParametersConverter());
    client.setRestClient(withingsRestClient());
    return client;
  }

  OAuth2AccessTokenResponseClient<OAuth2RefreshTokenGrantRequest> withingsRefreshTokenResponseClient() {
    RestClientRefreshTokenTokenResponseClient client = new RestClientRefreshTokenTokenResponseClient();
    client.setParametersConverter(withingsRefreshTokenRequestParametersConverter());
    client.setRestClient(withingsRestClient());
    return client;
  }

  private RestClient withingsRestClient() {
    OAuth2AccessTokenResponseHttpMessageConverter tokenResponseConverter = new OAuth2AccessTokenResponseHttpMessageConverter();
    tokenResponseConverter.setAccessTokenResponseConverter(withingsAccessTokenResponseConverter());
    return RestClient.builder()
        .configureMessageConverters(converters -> converters.addCustomConverter(tokenResponseConverter))
        .build();
  }

  Converter<OAuth2AuthorizationCodeGrantRequest, MultiValueMap<String, String>> withingsAccessTokenRequestParametersConverter() {
    return request -> {
      log.info("Requesting new Withings access token");
      MultiValueMap<String, String> parameters = new LinkedMultiValueMap<>();
      parameters.add("action", "requesttoken");
      parameters.add(OAuth2ParameterNames.CLIENT_ID, request.getClientRegistration().getClientId());
      parameters.add(OAuth2ParameterNames.CLIENT_SECRET, request.getClientRegistration().getClientSecret());
      return parameters;
    };
  }

  Converter<Map<String, Object>, OAuth2AccessTokenResponse> withingsAccessTokenResponseConverter() {
    return rawResponse -> {
      log.info("Converting Withings access token response");
      ObjectMapper mapper = new ObjectMapper();
      WithingsGetAccessTokenResponse response = mapper.convertValue(rawResponse, new TypeReference<>() {
      });

      if (response.getStatus() != 0) {
        log.error(response.getError());
        throw new OAuth2AuthorizationException(
            new OAuth2Error(OAuth2ErrorCodes.INVALID_GRANT, response.getError(), null));
      }

      WithingsGetAccessTokenResponseBody body = response.getBody();

      return OAuth2AccessTokenResponse
          .withToken(body.getAccessToken())
          .refreshToken(body.getRefreshToken())
          .expiresIn(body.getExpiresIn())
          .scopes(Set.of(body.getScope()))
          .tokenType(OAuth2AccessToken.TokenType.BEARER)
          .additionalParameters(Map.of("userId", body.getUserid()))
          .build();
    };
  }

  Converter<OAuth2RefreshTokenGrantRequest, MultiValueMap<String, String>> withingsRefreshTokenRequestParametersConverter() {
    return request -> {
      log.info("Refreshing expired Withings access token");
      MultiValueMap<String, String> parameters = new LinkedMultiValueMap<>();
      parameters.add("action", "requesttoken");
      parameters.add(OAuth2ParameterNames.CLIENT_ID, request.getClientRegistration().getClientId());
      parameters.add(OAuth2ParameterNames.CLIENT_SECRET, request.getClientRegistration().getClientSecret());
      return parameters;
    };
  }
}
