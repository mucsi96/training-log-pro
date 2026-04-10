package mucsi96.traininglog;

import java.util.Arrays;
import java.util.Collection;
import java.util.stream.Collectors;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.test.context.support.WithSecurityContextFactory;

public class WithMockUserRolesSecurityContextFactory implements WithSecurityContextFactory<WithMockUserRoles> {

    @Override
    public SecurityContext createSecurityContext(WithMockUserRoles mockUser) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        Collection<GrantedAuthority> authorities = Arrays.stream(mockUser.value())
                .flatMap(role -> Arrays.stream(new String[] {
                    "ROLE_" + role,  // For hasRole() checks
                    role              // For @RolesAllowed checks
                }))
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toList());

        Jwt jwt = Jwt.withTokenValue("mock-token")
                .header("alg", "none")
                .claim("sub", "rob")
                .claim("roles", mockUser.value())
                .build();

        JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt, authorities);
        context.setAuthentication(authentication);
        return context;
    }

}
