package mucsi96.traininglog.coins;

import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.Coins;

@RestController
@RequestMapping(value = "/coins", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class CoinsController {

  private final CoinsService coinsService;

  @GetMapping
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  Coins getCoins() {
    return coinsService.getCoins();
  }

  @PostMapping("/reset")
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  Coins resetCoins() {
    return coinsService.resetCoins();
  }
}
