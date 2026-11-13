package mucsi96.traininglog.device;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface DeviceBookRepository extends JpaRepository<DeviceBookEntity, UUID> {
  List<DeviceBookSummary> findByDeviceIdOrderByCreatedAtAsc(UUID deviceId);

  @Modifying
  @Query("delete from DeviceBookEntity b where b.id = :id and b.deviceId = :deviceId")
  int deleteBook(UUID id, UUID deviceId);

  @Modifying
  @Query("delete from DeviceBookEntity b where b.deviceId = :deviceId")
  void deleteByDeviceId(UUID deviceId);
}
