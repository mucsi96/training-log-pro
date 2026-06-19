package mucsi96.traininglog.learning;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.LearningPathBlock;
import mucsi96.traininglog.api.LearningPathContent;
import mucsi96.traininglog.api.LearningPathTopic;

@Service
@RequiredArgsConstructor
public class LearningPathService {

  private final LearningPathRepository pathRepository;
  private final LearningPathActivityRepository activityRepository;
  private final LearningPathProgressRepository progressRepository;
  private final LearningPathGenerationService generationService;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  @Transactional(readOnly = true)
  public List<LearningPathEntity> list() {
    return pathRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
  }

  @Transactional(readOnly = true)
  public LearningPathEntity get(UUID id) {
    return pathRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Learning path not found"));
  }

  public LearningPathContent generate(String prompt, LearningPathContent current) {
    LearningPathContent content = generationService.generate(prompt, current);
    assignIds(content);
    return content;
  }

  @Transactional
  public LearningPathEntity create(String title, LearningPathContent content) {
    assignIds(content);
    LearningPathEntity path = LearningPathEntity.builder()
        .id(UUID.randomUUID())
        .title(title)
        .content(content)
        .createdAt(now())
        .build();
    refreshCompletion(path);
    return pathRepository.save(path);
  }

  @Transactional
  public LearningPathEntity update(UUID id, String title, LearningPathContent content) {
    LearningPathEntity path = get(id);
    assignIds(content);
    path.setTitle(title);
    path.setContent(content);
    refreshCompletion(path);
    return pathRepository.save(path);
  }

  @Transactional
  public void delete(UUID id) {
    if (!pathRepository.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Learning path not found");
    }
    progressRepository.deleteByPathId(id);
    activityRepository.deleteByPathId(id);
    pathRepository.deleteById(id);
  }

  @Transactional
  public LearningPathEntity setBlockCompleted(UUID id, String blockId, boolean completed) {
    LearningPathEntity path = get(id);
    // Deep-copy the content so the value we persist is a different object than the one
    // Hibernate snapshotted at load. Mutating the loaded JSONB graph in place is not
    // reliably flagged dirty; replacing the reference guarantees the UPDATE fires.
    LearningPathContent content = objectMapper.convertValue(path.getContent(), LearningPathContent.class);
    LearningPathBlock block = content.getTopics().stream()
        .filter(topic -> topic.getBlocks() != null)
        .flatMap(topic -> topic.getBlocks().stream())
        .filter(candidate -> blockId.equals(candidate.getId()))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Block not found"));
    block.setCompleted(completed);
    path.setContent(content);
    refreshCompletion(path);
    return pathRepository.save(path);
  }

  @Transactional
  public void setActivity(UUID pathId, LocalDate date, boolean active) {
    if (!pathRepository.existsById(pathId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Learning path not found");
    }
    if (active) {
      activityRepository.insertIfAbsent(UUID.randomUUID(), pathId, date, now());
    } else {
      activityRepository.deleteByPathIdAndDate(pathId, date);
    }
  }

  @Transactional
  public LearningPathProgressEntity logProgress(UUID pathId, int durationMinutes, String description,
      String comment) {
    if (!pathRepository.existsById(pathId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Learning path not found");
    }
    LearningPathProgressEntity entry = LearningPathProgressEntity.builder()
        .id(UUID.randomUUID())
        .pathId(pathId)
        .createdAt(now())
        .durationMinutes(durationMinutes)
        .description(description)
        .comment(comment)
        .build();
    return progressRepository.save(entry);
  }

  @Transactional(readOnly = true)
  public List<LearningPathProgressEntity> getProgress(UUID pathId) {
    if (!pathRepository.existsById(pathId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Learning path not found");
    }
    return progressRepository.findByPathId(pathId, Sort.by(Sort.Direction.DESC, "createdAt"));
  }

  @Transactional(readOnly = true)
  public TodayPaths getTodayPaths(LocalDate date) {
    Set<UUID> activeIds = activityRepository.findByDate(date).stream()
        .map(LearningPathActivityEntity::getPathId)
        .collect(Collectors.toSet());
    return new TodayPaths(list(), activeIds);
  }

  @Transactional(readOnly = true)
  public Map<LocalDate, Set<UUID>> getActivityByDays(Collection<LocalDate> dates) {
    if (dates.isEmpty()) {
      return Map.of();
    }
    return activityRepository.findByDateIn(dates).stream()
        .collect(Collectors.groupingBy(
            LearningPathActivityEntity::getDate,
            TreeMap::new,
            Collectors.mapping(LearningPathActivityEntity::getPathId, Collectors.toSet())));
  }

  public record TodayPaths(List<LearningPathEntity> paths, Set<UUID> activePathIds) {
  }

  private void refreshCompletion(LearningPathEntity path) {
    List<LearningPathBlock> blocks = path.getContent().getTopics().stream()
        .filter(topic -> topic.getBlocks() != null)
        .flatMap(topic -> topic.getBlocks().stream())
        .toList();
    boolean allDone = !blocks.isEmpty()
        && blocks.stream().allMatch(block -> Boolean.TRUE.equals(block.getCompleted()));
    if (allDone && path.getCompletedAt() == null) {
      path.setCompletedAt(now());
    } else if (!allDone && path.getCompletedAt() != null) {
      path.setCompletedAt(null);
    }
  }

  private void assignIds(LearningPathContent content) {
    if (content == null || content.getTopics() == null) {
      return;
    }
    for (LearningPathTopic topic : content.getTopics()) {
      if (topic.getId() == null || topic.getId().isBlank()) {
        topic.setId(UUID.randomUUID().toString());
      }
      if (topic.getBlocks() == null) {
        continue;
      }
      for (LearningPathBlock block : topic.getBlocks()) {
        if (block.getId() == null || block.getId().isBlank()) {
          block.setId(UUID.randomUUID().toString());
        }
        if (block.getCompleted() == null) {
          block.setCompleted(false);
        }
      }
    }
  }

  private ZonedDateTime now() {
    return ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
  }
}
