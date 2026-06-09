package mucsi96.traininglog.location;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LocationRepository extends JpaRepository<LocationEntity, UUID> {
  Optional<LocationEntity> findFirstByHomeTrue();
}
