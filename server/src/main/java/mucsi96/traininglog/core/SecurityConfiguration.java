package mucsi96.traininglog.core;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
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
    @Order(1)
    SecurityFilterChain stravaSecurityFilterChain(HttpSecurity http,
            StravaConfiguration stravaConfiguration) throws Exception {
        return http
                .securityMatcher("/strava/**")
                .csrf(AbstractHttpConfigurer::disable)
                .oauth2Client(configurer -> configurer
                        .authorizationCodeGrant(customizer -> customizer
                                .accessTokenResponseClient(
                                        stravaConfiguration.stravaAccessTokenResponseClient())))
                .authorizeHttpRequests(
                        authorize -> authorize.anyRequest().authenticated())
                .build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain withingsSecurityFilterChain(HttpSecurity http,
            WithingsConfiguration withingsConfiguration) throws Exception {
        return http
                .securityMatcher("/withings/**")
                .csrf(AbstractHttpConfigurer::disable)
                .oauth2Client(configurer -> configurer
                        .authorizationCodeGrant(customizer -> customizer
                                .accessTokenResponseClient(
                                        withingsConfiguration.withingsAccessTokenResponseClient())))
                .authorizeHttpRequests(
                        authorize -> authorize.anyRequest().authenticated())
                .build();
    }

    @Bean
    @Order(3)
    @Profile({"prod", "local"})
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.with(AadResourceServerHttpSecurityConfigurer.aadResourceServer(),
                Customizer.withDefaults());

        http.authorizeHttpRequests(requests -> requests
                .requestMatchers("/environment").permitAll()
                .requestMatchers("/actuator/**").permitAll()
                .anyRequest().authenticated());

        return http.build();
    }

    @Bean
    @Order(3)
    @Profile("test")
    SecurityFilterChain testSecurityFilterChain(HttpSecurity http)
            throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(
                        auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
