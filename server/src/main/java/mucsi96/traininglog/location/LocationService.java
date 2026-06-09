package mucsi96.traininglog.location;

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
import mucsi96.traininglog.api.LocationRequest;

@Service
@RequiredArgsConstructor
public class LocationService {

  private final LocationRepository repository;
  private final Clock clock;

  @Transactional(readOnly = true)
  public List<LocationEntity> list() {
    return repository.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
  }

  @Transactional
  public LocationEntity add(LocationRequest request) {
    LocationEntity location = LocationEntity.builder()
        .id(UUID.randomUUID())
        .createdAt(now())
        .build();
    apply(location, request);
    return repository.save(location);
  }

  @Transactional
  public LocationEntity update(UUID id, LocationRequest request) {
    LocationEntity location = repository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found"));
    apply(location, request);
    return repository.save(location);
  }

  @Transactional
  public void delete(UUID id) {
    if (!repository.existsById(id)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found");
    }
    repository.deleteById(id);
  }

  private void apply(LocationEntity location, LocationRequest request) {
    location.setName(request.getName().trim());
    location.setAddress(request.getAddress());
    location.setLatitude(request.getLatitude());
    location.setLongitude(request.getLongitude());
    location.setHome(Boolean.TRUE.equals(request.getHome()));
    location.setBikeMinutesFromHome(request.getBikeMinutesFromHome());
    location.setCarMinutesFromHome(request.getCarMinutesFromHome());
  }

  private ZonedDateTime now() {
    return ZonedDateTime.now(clock).withZoneSameInstant(ZoneOffset.UTC).truncatedTo(ChronoUnit.MILLIS);
  }
}
