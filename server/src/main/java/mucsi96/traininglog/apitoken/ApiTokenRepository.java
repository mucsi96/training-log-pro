package mucsi96.traininglog.apitoken;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ApiTokenRepository extends JpaRepository<ApiTokenEntity, UUID> {
  List<ApiTokenEntity> findAll(Sort sort);

  @Query("select t.encryptedToken from ApiTokenEntity t")
  List<String> findAllEncryptedTokens();
}
