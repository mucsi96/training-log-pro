package mucsi96.traininglog.core;

import java.time.ZoneId;
import java.util.Objects;
import java.util.function.BiConsumer;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import mucsi96.traininglog.strava.StravaConfiguration;
import mucsi96.traininglog.withings.WithingsConfiguration;

@Component
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
public class DailySyncScheduler {

  private final JdbcTemplate jdbcTemplate;
  private final DailySyncService dailySyncService;
  private final OAuth2AuthorizedClientManager withingsBackgroundClientManager;
  private final OAuth2AuthorizedClientManager stravaBackgroundClientManager;

  @Value("${daily-sync.zone}")
  private ZoneId zoneId;

  @Scheduled(cron = "${daily-sync.cron}", zone = "${daily-sync.zone}")
  public void sync() {
    // Weight first so FTP calculation includes today's measurement.
    syncClients(WithingsConfiguration.registrationId, withingsBackgroundClientManager, dailySyncService::syncWeight);
    syncClients(StravaConfiguration.registrationId, stravaBackgroundClientManager, dailySyncService::syncStrava);
  }

  private void syncClients(String registrationId, OAuth2AuthorizedClientManager manager,
      BiConsumer<OAuth2AuthorizedClient, ZoneId> sync) {
    jdbcTemplate.queryForList(
        "SELECT principal_name FROM oauth2_authorized_client WHERE client_registration_id = ?",
        String.class, registrationId).forEach(principal -> {
          try {
            var request = OAuth2AuthorizeRequest.withClientRegistrationId(registrationId)
                .principal(principal).build();
            var client = Objects.requireNonNull(manager.authorize(request), "OAuth authorization is required");
            sync.accept(client, zoneId);
            log.info("Scheduled {} sync completed for {}", registrationId, principal);
          } catch (Exception ex) {
            // A disconnected or failing integration must not prevent the others from syncing.
            log.error("Scheduled {} sync failed for {}", registrationId, principal, ex);
          }
        });
  }
}
