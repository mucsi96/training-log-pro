package mucsi96.traininglog.core;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfiguration {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())));

        http.authorizeHttpRequests(requests -> requests
                .requestMatchers(
                        "/environment",
                        "/actuator/**",
                        "/strava/authorize",
                        "/withings/authorize")
                .permitAll()
                .anyRequest().authenticated());

        return http.build();
    }

    private Converter<Jwt, AbstractAuthenticationToken> jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();

        return jwt -> {
            List<GrantedAuthority> authorities = Stream.concat(
                    scopeConverter.convert(jwt).stream(),
                    Optional.ofNullable(jwt.getClaimAsStringList("roles"))
                            .stream()
                            .flatMap(Collection::stream)
                            .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("APPROLE_" + role)))
                    .toList();
            // Prefer `email`; fall back to `preferred_username` so tokens without
            // the email optional claim still produce a stable, human-readable principal.
            String principal = Optional.ofNullable(jwt.getClaimAsString("email"))
                    .orElseGet(() -> jwt.getClaimAsString("preferred_username"));
            return new JwtAuthenticationToken(jwt, authorities, principal);
        };
    }
}
