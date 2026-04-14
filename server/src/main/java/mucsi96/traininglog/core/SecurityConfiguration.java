package mucsi96.traininglog.core;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest;
import org.springframework.security.web.SecurityFilterChain;

import com.azure.spring.cloud.autoconfigure.implementation.aad.security.AadResourceServerHttpSecurityConfigurer;

import mucsi96.traininglog.strava.StravaConfiguration;
import mucsi96.traininglog.withings.WithingsConfiguration;

@Configuration
public class SecurityConfiguration {

    @Profile({"prod", "local"})
    @Configuration
    @EnableMethodSecurity(prePostEnabled = true)
    static class MethodSecurityConfig {
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            Environment environment,
            StravaConfiguration stravaConfiguration,
            WithingsConfiguration withingsConfiguration) throws Exception {

        if (environment.matchesProfiles("test")) {
            http.csrf(AbstractHttpConfigurer::disable);
        } else {
            http.with(AadResourceServerHttpSecurityConfigurer.aadResourceServer(),
                    Customizer.withDefaults());
            http.csrf(csrf -> csrf
                    .ignoringRequestMatchers("/strava/**", "/withings/**"));
        }

        http.oauth2Client(configurer -> configurer
                .authorizationCodeGrant(customizer -> customizer
                        .accessTokenResponseClient(
                                delegatingAccessTokenResponseClient(
                                        stravaConfiguration,
                                        withingsConfiguration))));

        if (environment.matchesProfiles("test")) {
            http.authorizeHttpRequests(requests -> requests
                    .requestMatchers("/strava/**").authenticated()
                    .requestMatchers("/withings/**").authenticated()
                    .anyRequest().permitAll());
        } else {
            http.authorizeHttpRequests(requests -> requests
                    .requestMatchers("/environment").permitAll()
                    .requestMatchers("/actuator/**").permitAll()
                    .anyRequest().authenticated());
        }

        return http.build();
    }

    private OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> delegatingAccessTokenResponseClient(
            StravaConfiguration stravaConfiguration,
            WithingsConfiguration withingsConfiguration) {
        OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> stravaClient =
                stravaConfiguration.stravaAccessTokenResponseClient();
        OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> withingsClient =
                withingsConfiguration.withingsAccessTokenResponseClient();

        return request -> {
            String registrationId = request.getClientRegistration().getRegistrationId();
            if (StravaConfiguration.registrationId.equals(registrationId)) {
                return stravaClient.getTokenResponse(request);
            }
            if (WithingsConfiguration.registrationId.equals(registrationId)) {
                return withingsClient.getTokenResponse(request);
            }
            throw new IllegalArgumentException("Unknown client registration: " + registrationId);
        };
    }
}
