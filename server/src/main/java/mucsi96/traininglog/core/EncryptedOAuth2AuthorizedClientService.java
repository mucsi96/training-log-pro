package mucsi96.traininglog.core;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;

import lombok.RequiredArgsConstructor;

/**
 * Decorates an {@link OAuth2AuthorizedClientService} so that the access and
 * refresh token values are encrypted at rest. Everything else about the stored
 * client (registration id, principal, token type, timestamps, scopes) is left
 * untouched so the surrounding OAuth machinery keeps working unchanged.
 */
@RequiredArgsConstructor
public class EncryptedOAuth2AuthorizedClientService implements OAuth2AuthorizedClientService {

  private final OAuth2AuthorizedClientService delegate;
  private final TokenEncryptor tokenEncryptor;

  @Override
  @SuppressWarnings("unchecked")
  public <T extends OAuth2AuthorizedClient> T loadAuthorizedClient(String clientRegistrationId,
      String principalName) {
    OAuth2AuthorizedClient client = delegate.loadAuthorizedClient(clientRegistrationId, principalName);
    return client == null ? null : (T) mapTokens(client, tokenEncryptor::decrypt);
  }

  @Override
  public void saveAuthorizedClient(OAuth2AuthorizedClient authorizedClient, Authentication principal) {
    delegate.saveAuthorizedClient(mapTokens(authorizedClient, tokenEncryptor::encrypt), principal);
  }

  @Override
  public void removeAuthorizedClient(String clientRegistrationId, String principalName) {
    delegate.removeAuthorizedClient(clientRegistrationId, principalName);
  }

  private OAuth2AuthorizedClient mapTokens(OAuth2AuthorizedClient client,
      java.util.function.Function<String, String> mapper) {
    OAuth2AccessToken accessToken = client.getAccessToken();
    OAuth2AccessToken mappedAccessToken = new OAuth2AccessToken(
        accessToken.getTokenType(),
        mapper.apply(accessToken.getTokenValue()),
        accessToken.getIssuedAt(),
        accessToken.getExpiresAt(),
        accessToken.getScopes());

    OAuth2RefreshToken refreshToken = client.getRefreshToken();
    OAuth2RefreshToken mappedRefreshToken = refreshToken == null ? null
        : new OAuth2RefreshToken(
            mapper.apply(refreshToken.getTokenValue()),
            refreshToken.getIssuedAt(),
            refreshToken.getExpiresAt());

    return new OAuth2AuthorizedClient(
        client.getClientRegistration(),
        client.getPrincipalName(),
        mappedAccessToken,
        mappedRefreshToken);
  }
}
