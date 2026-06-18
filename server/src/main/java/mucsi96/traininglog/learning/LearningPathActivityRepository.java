package mucsi96.traininglog.learning;

import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LearningPathActivityRepository
    extends JpaRepository<LearningPathActivityEntity, UUID> {
  List<LearningPathActivityEntity> findByDate(LocalDate date);

  List<LearningPathActivityEntity> findByDateIn(Collection<LocalDate> dates);

  void deleteByPathId(UUID pathId);

  void deleteByPathIdAndDate(UUID pathId, LocalDate date);

  @Modifying
  @Query(value = "INSERT INTO training_log.learning_path_activity (id, path_id, date, created_at) "
      + "VALUES (:id, :pathId, :date, :createdAt) "
      + "ON CONFLICT (path_id, date) DO NOTHING", nativeQuery = true)
  void insertIfAbsent(
      @Param("id") UUID id,
      @Param("pathId") UUID pathId,
      @Param("date") LocalDate date,
      @Param("createdAt") ZonedDateTime createdAt);
}
