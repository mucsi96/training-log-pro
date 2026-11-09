package mucsi96.traininglog.segments;

import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class SegmentEffortService {
  private final SegmentEffortRepository segmentEffortRepository;

  public void saveAll(List<SegmentEffort> efforts) {
    if (efforts.isEmpty()) {
      return;
    }
    log.info("persisting {} segment efforts", efforts.size());
    segmentEffortRepository.saveAll(efforts);
  }
}
