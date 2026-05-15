package mucsi96.traininglog.ftp;

import java.time.ZonedDateTime;
import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FtpRepository extends JpaRepository<Ftp, ZonedDateTime> {
  List<Ftp> findByCreatedAtBetween(ZonedDateTime startTime, ZonedDateTime endTime, Sort sort);
  List<Ftp> findByCreatedAtBefore(ZonedDateTime endTime, Sort sort);
}
