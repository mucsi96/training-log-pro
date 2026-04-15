package mucsi96.traininglog.core;

import java.io.IOException;
import java.util.Collections;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.preauth.PreAuthenticatedAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RequiredArgsConstructor
@Slf4j
public class OneTimeTokenBridgeFilter extends OncePerRequestFilter {

  private final TokenService tokenService;

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String tokenValue = request.getParameter("token");

    if (tokenValue != null && SecurityContextHolder.getContext().getAuthentication() == null) {
      try {
        String username = tokenService.consume(tokenValue);
        PreAuthenticatedAuthenticationToken authentication = new PreAuthenticatedAuthenticationToken(
            username, null, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(authentication);
        log.info("Successfully authenticated via token for user: {}", username);
      } catch (Exception e) {
        log.debug("Token authentication failed: {}", e.getMessage());
      }
    }

    filterChain.doFilter(request, response);
  }
}
