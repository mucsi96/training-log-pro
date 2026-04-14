package mucsi96.traininglog.core;

import java.util.Map;

import org.springframework.security.authentication.ott.GenerateOneTimeTokenRequest;
import org.springframework.security.authentication.ott.OneTimeToken;
import org.springframework.security.authentication.ott.OneTimeTokenService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/token-bridge")
@RequiredArgsConstructor
public class TokenBridgeController {

  private final OneTimeTokenService oneTimeTokenService;

  @PostMapping("/generate")
  public Map<String, String> generate(Authentication auth) {
    GenerateOneTimeTokenRequest request = new GenerateOneTimeTokenRequest(auth.getName());
    OneTimeToken token = oneTimeTokenService.generate(request);
    return Map.of("token", token.getTokenValue());
  }
}
