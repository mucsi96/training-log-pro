package mucsi96.traininglog.apitoken;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApiTokenRepository extends JpaRepository<ApiTokenEntity, UUID> {
  List<ApiTokenEntity> findAll(Sort sort);

  boolean existsByTokenHash(String tokenHash);
}
