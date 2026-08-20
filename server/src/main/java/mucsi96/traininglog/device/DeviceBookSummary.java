package mucsi96.traininglog.device;

import java.time.ZonedDateTime;
import java.util.UUID;

// Projection so listing pending books never loads the ebook blobs.
public interface DeviceBookSummary {
  UUID getId();

  String getFileName();

  ZonedDateTime getCreatedAt();
}
