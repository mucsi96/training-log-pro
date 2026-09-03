package mucsi96.traininglog.settings;

import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.Settings;
import mucsi96.traininglog.daygoal.DayGoalRequirementService;

@RestController
@RequestMapping(value = "/settings", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class SettingsController {

  private final DayGoalRequirementService requirementService;

  @GetMapping
  @PreAuthorize("hasAuthority('APPROLE_WorkoutReader') and hasAuthority('SCOPE_readWorkouts')")
  Settings getSettings() {
    return Settings.builder().tiers(requirementService.getTierGoals()).build();
  }

  @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
  @PreAuthorize("hasAuthority('APPROLE_WorkoutCreator') and hasAuthority('SCOPE_createWorkout')")
  Settings updateSettings(@RequestBody Settings request) {
    return Settings.builder().tiers(requirementService.update(request.getTiers())).build();
  }
}
