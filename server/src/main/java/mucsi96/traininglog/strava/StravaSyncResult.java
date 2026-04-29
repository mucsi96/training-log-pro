package mucsi96.traininglog.strava;

import java.util.List;

import lombok.Builder;
import lombok.Data;
import mucsi96.traininglog.rides.Ride;
import mucsi96.traininglog.segments.SegmentEffort;

@Data
@Builder
public class StravaSyncResult {
  private final List<Ride> rides;
  private final List<SegmentEffort> segmentEfforts;
}
