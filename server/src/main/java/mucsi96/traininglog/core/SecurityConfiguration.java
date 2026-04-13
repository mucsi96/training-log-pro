package mucsi96.traininglog.core;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

@Profile({"prod", "local"})
@Configuration
@EnableMethodSecurity(prePostEnabled = true)
@EnableScheduling
public class SecurityConfiguration {

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            List<GrantedAuthority> authorities = new ArrayList<>();

            List<String> roles = jwt.getClaimAsStringList("roles");
            if (roles != null) {
                roles.forEach(role -> authorities.add(
                        new SimpleGrantedAuthority("APPROLE_" + role)));
            }

            String scp = jwt.getClaimAsString("scp");
            if (scp != null) {
                Arrays.stream(scp.split(" "))
                        .forEach(scope -> authorities.add(
                                new SimpleGrantedAuthority("SCOPE_" + scope)));
            }

            return authorities;
        });
        return converter;
    }

    @Bean
    @Order(3)
    SecurityFilterChain securityFilterChain(HttpSecurity http)
            throws Exception {

        http.oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())));

        http.authorizeHttpRequests(requests -> requests
                .requestMatchers("/environment").permitAll()
                .requestMatchers("/actuator/**").permitAll()
                .anyRequest().authenticated());

        return http.build();
    }
}
