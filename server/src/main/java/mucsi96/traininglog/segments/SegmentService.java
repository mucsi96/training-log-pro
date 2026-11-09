package mucsi96.traininglog.segments;

import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class SegmentService {
  private final SegmentRepository segmentRepository;

  public void saveAll(List<Segment> segments) {
    if (segments.isEmpty()) {
      return;
    }
    log.info("persisting {} segments", segments.size());
    segmentRepository.saveAll(segments);
  }
}
