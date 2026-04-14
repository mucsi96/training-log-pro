package mucsi96.traininglog.core;

import java.io.IOException;
import java.util.Collections;

import org.springframework.security.authentication.ott.OneTimeToken;
import org.springframework.security.authentication.ott.OneTimeTokenAuthenticationToken;
import org.springframework.security.authentication.ott.OneTimeTokenService;
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

  private final OneTimeTokenService oneTimeTokenService;

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String tokenValue = request.getParameter("token");

    if (tokenValue != null && SecurityContextHolder.getContext().getAuthentication() == null) {
      try {
        OneTimeTokenAuthenticationToken authRequest = new OneTimeTokenAuthenticationToken(tokenValue);
        OneTimeToken token = oneTimeTokenService.consume(authRequest);
        PreAuthenticatedAuthenticationToken authentication = new PreAuthenticatedAuthenticationToken(
            token.getUsername(), null, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(authentication);
        log.info("Successfully authenticated via one-time token for user: {}", token.getUsername());
      } catch (Exception e) {
        log.debug("One-time token authentication failed: {}", e.getMessage());
      }
    }

    filterChain.doFilter(request, response);
  }
}
