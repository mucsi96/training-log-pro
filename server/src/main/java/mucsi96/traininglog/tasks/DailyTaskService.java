package mucsi96.traininglog.tasks;

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

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DailyTaskService {

  private final DailyTaskRepository taskRepository;
  private final DailyTaskCompletionRepository completionRepository;
  private final Clock clock;

  @Transactional(readOnly = true)
  public List<DailyTaskEntity> listTasks() {
    return taskRepository.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
  }

  @Transactional
  public DailyTaskEntity addTask(String name) {
    DailyTaskEntity task = DailyTaskEntity.builder()
        .id(UUID.randomUUID())
        .name(name)
        .createdAt(now())
        .build();
    return taskRepository.save(task);
  }

  @Transactional
  public DailyTaskEntity renameTask(UUID id, String name) {
    DailyTaskEntity task = taskRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    task.setName(name);
    return taskRepository.save(task);
  }

  @Transactional
  public void deleteTask(UUID id) {
    if (!taskRepository.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found");
    }
    completionRepository.deleteByTaskId(id);
    taskRepository.deleteById(id);
  }

  @Transactional
  public void setCompletion(UUID taskId, LocalDate date, boolean completed) {
    if (!taskRepository.existsById(taskId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found");
    }
    if (completed) {
      if (completionRepository.findByTaskIdAndDate(taskId, date).isPresent()) {
        return;
      }
      try {
        completionRepository.save(DailyTaskCompletionEntity.builder()
            .id(UUID.randomUUID())
            .taskId(taskId)
            .date(date)
            .completedAt(now())
            .build());
      } catch (DataIntegrityViolationException ignored) {
        // Concurrent request already inserted the completion — treat as success.
      }
    } else {
      completionRepository.deleteByTaskIdAndDate(taskId, date);
    }
  }

  @Transactional(readOnly = true)
  public List<DailyTaskCompletionEntity> getCompletionsForDay(LocalDate date) {
    return completionRepository.findByDate(date);
  }

  @Transactional(readOnly = true)
  public Map<LocalDate, Set<UUID>> getCompletionsByDays(Collection<LocalDate> dates) {
    if (dates.isEmpty()) {
      return Map.of();
    }
    return completionRepository.findByDateIn(dates).stream()
        .collect(Collectors.groupingBy(
            DailyTaskCompletionEntity::getDate,
            TreeMap::new,
            Collectors.mapping(DailyTaskCompletionEntity::getTaskId, Collectors.toSet())));
  }

  private ZonedDateTime now() {
    return ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
  }
}
