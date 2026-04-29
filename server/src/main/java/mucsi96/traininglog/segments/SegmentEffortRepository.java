package mucsi96.traininglog.segments;

import java.time.ZonedDateTime;
import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SegmentEffortRepository extends JpaRepository<SegmentEffort, Long> {
  List<SegmentEffort> findByStartDateBetween(ZonedDateTime startTime, ZonedDateTime endTime, Sort sort);

  List<SegmentEffort> findBySegmentIdAndStartDateGreaterThanEqual(long segmentId, ZonedDateTime startTime, Sort sort);

  List<SegmentEffort> findBySegmentId(long segmentId, Sort sort);
}
