package mucsi96.traininglog.activity;

import java.time.Clock;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;
import mucsi96.traininglog.api.ActivityRequest;

@Service
@RequiredArgsConstructor
public class ActivityService {

  private final ActivityRepository repository;
  private final Clock clock;

  @Transactional(readOnly = true)
  public List<ActivityEntity> list() {
    return repository.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
  }

  @Transactional
  public ActivityEntity add(ActivityRequest request) {
    ActivityEntity activity = ActivityEntity.builder()
        .id(UUID.randomUUID())
        .createdAt(now())
        .build();
    apply(activity, request);
    return repository.save(activity);
  }

  @Transactional
  public ActivityEntity update(UUID id, ActivityRequest request) {
    ActivityEntity activity = repository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found"));
    apply(activity, request);
    return repository.save(activity);
  }

  @Transactional
  public void delete(UUID id) {
    if (!repository.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Activity not found");
    }
    repository.deleteById(id);
  }

  private void apply(ActivityEntity activity, ActivityRequest request) {
    activity.setName(request.getName().trim());
    activity.setDurationMinutes(request.getDurationMinutes());
    activity.setOccurrencesPerWeek(request.getOccurrencesPerWeek());
    activity.setLocationId(request.getLocationId());
    activity.setEarliestTime(request.getEarliestTime());
    activity.setLatestTime(request.getLatestTime());
    activity.setDaysOfWeek(request.getDaysOfWeek());
    activity.setConstraintNote(request.getConstraintNote());
    activity.setPriority(request.getPriority());
  }

  private ZonedDateTime now() {
    return ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
  }
}
