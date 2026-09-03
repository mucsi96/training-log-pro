package mucsi96.traininglog.daygoal;

import java.util.Collection;
import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.DayGoalMetric;
import mucsi96.traininglog.api.DayGoalTier;
import mucsi96.traininglog.api.MetricGoal;
import mucsi96.traininglog.api.TierGoals;

/**
 * What each day goal tier takes. Internally a tier is the map of the metrics it
 * requires to their goals; the API view lists every metric of every tier with a
 * {@code required} flag so that it can be edited as a form.
 */
@Service
@RequiredArgsConstructor
public class DayGoalRequirementService {

  static final int MIN_GOAL = 1;
  static final int MAX_GOAL = 100_000;

  private final DayGoalRequirementRepository repository;

  /**
   * The required metrics and their goals of every tier, keyed from the most to
   * the least demanding tier. A tier mapped to no metric is never awarded.
   */
  @Transactional(readOnly = true)
  public Map<DayGoalTier, Map<DayGoalMetric, Integer>> getRequirements() {
    return byTier(repository.findAll());
  }

  @Transactional(readOnly = true)
  public List<TierGoals> getTierGoals() {
    return toTierGoals(getRequirements());
  }

  @Transactional
  public List<TierGoals> update(List<TierGoals> tiers) {
    List<DayGoalRequirementEntity> requirements = toEntities(tiers);
    // A bulk delete runs at once; a plain deleteAll would be flushed after the
    // inserts and violate the (tier, metric) uniqueness in between.
    repository.deleteAllInBatch();
    repository.saveAll(requirements);
    return toTierGoals(byTier(requirements));
  }

  public static List<TierGoals> toTierGoals(Map<DayGoalTier, Map<DayGoalMetric, Integer>> requirements) {
    return requirements.entrySet().stream()
        .map(tier -> TierGoals.builder()
            .tier(tier.getKey())
            .goals(Stream.of(DayGoalMetric.values())
                .map(metric -> MetricGoal.builder()
                    .metric(metric)
                    .required(tier.getValue().containsKey(metric))
                    .goal(tier.getValue().get(metric))
                    .build())
                .toList())
            .build())
        .toList();
  }

  private static Map<DayGoalTier, Map<DayGoalMetric, Integer>> byTier(
      Collection<DayGoalRequirementEntity> requirements) {
    Map<DayGoalTier, Map<DayGoalMetric, Integer>> configured = requirements.stream()
        .collect(Collectors.groupingBy(
            DayGoalRequirementEntity::getTier,
            Collectors.toMap(DayGoalRequirementEntity::getMetric, DayGoalRequirementEntity::getGoal)));
    return Collections.unmodifiableMap(Stream.of(DayGoalTier.values())
        .collect(Collectors.toMap(
            Function.identity(),
            tier -> configured.getOrDefault(tier, Map.of()),
            (a, b) -> a,
            () -> new EnumMap<>(DayGoalTier.class))));
  }

  private static List<DayGoalRequirementEntity> toEntities(List<TierGoals> tiers) {
    Set<DayGoalTier> configured = tiers.stream().map(TierGoals::getTier).collect(Collectors.toSet());
    if (tiers.size() != DayGoalTier.values().length || !configured.equals(EnumSet.allOf(DayGoalTier.class))) {
      throw badRequest("Every tier has to be configured exactly once");
    }
    List<DayGoalRequirementEntity> requirements = tiers.stream()
        .flatMap(tier -> tier.getGoals().stream()
            .filter(MetricGoal::getRequired)
            .map(goal -> toEntity(tier.getTier(), goal)))
        .toList();
    long distinct = requirements.stream()
        .map(requirement -> Map.entry(requirement.getTier(), requirement.getMetric()))
        .distinct()
        .count();
    if (distinct != requirements.size()) {
      throw badRequest("A metric can be required only once per tier");
    }
    return requirements;
  }

  private static DayGoalRequirementEntity toEntity(DayGoalTier tier, MetricGoal goal) {
    Integer target = goal.getGoal();
    if (target == null || target < MIN_GOAL || target > MAX_GOAL) {
      throw badRequest("The goal of a required metric has to be between " + MIN_GOAL + " and " + MAX_GOAL);
    }
    return DayGoalRequirementEntity.builder()
        .id(UUID.randomUUID())
        .tier(tier)
        .metric(goal.getMetric())
        .goal(target)
        .build();
  }

  private static ResponseStatusException badRequest(String reason) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
  }
}
