package mucsi96.traininglog.device;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceBookRepository extends JpaRepository<DeviceBookEntity, UUID> {
  List<DeviceBookSummary> findByDeviceIdOrderByCreatedAtAsc(UUID deviceId);

  Optional<DeviceBookEntity> findByIdAndDeviceId(UUID id, UUID deviceId);

  void deleteByDeviceId(UUID deviceId);
}
