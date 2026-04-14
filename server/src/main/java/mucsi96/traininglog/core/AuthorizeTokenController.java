package mucsi96.traininglog.core;

import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
public class AuthorizeTokenController {

  private final AuthorizeTokenService authorizeTokenService;

  @PostMapping("/authorize-token")
  public Map<String, String> createToken() {
    return Map.of("token", authorizeTokenService.createToken());
  }
}
