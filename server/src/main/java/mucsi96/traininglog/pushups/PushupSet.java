package mucsi96.traininglog.pushups;

import java.time.ZonedDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Entity
@Table(name = "pushup_set", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class PushupSet {
    @Id
    private ZonedDateTime createdAt;

    @Column(nullable = false)
    private int count;
}
