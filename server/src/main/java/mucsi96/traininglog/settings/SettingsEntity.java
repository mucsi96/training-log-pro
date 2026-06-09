package mucsi96.traininglog.settings;

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
@Table(name = "settings", schema = "training_log")
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SettingsEntity {
  static final int SINGLETON_ID = 1;

  @Id
  private Integer id;

  @Column(name = "pushup_goal", nullable = false)
  private int pushupGoal;

  @Column(name = "elevation_goal", nullable = false)
  private int elevationGoal;

  @Column(name = "reading_pages_goal", nullable = false)
  private int readingPagesGoal;

  @Column(name = "daily_task_goal", nullable = false)
  private int dailyTaskGoal;

  @Column(name = "home_lat")
  private Double homeLat;

  @Column(name = "home_lng")
  private Double homeLng;

  @Column(name = "office_address")
  private String officeAddress;

  @Column(name = "school_address")
  private String schoolAddress;

  @Column(name = "work_start_time")
  private String workStartTime;

  @Column(name = "work_end_time")
  private String workEndTime;

  @Column(name = "son_pickup_time")
  private String sonPickupTime;

  @Column(name = "commute_bike_minutes")
  private Integer commuteBikeMinutes;

  @Column(name = "commute_car_minutes")
  private Integer commuteCarMinutes;

  @Column(name = "rain_threshold_mm")
  private Double rainThresholdMm;

  @Column(name = "pomodoro_minutes")
  private Integer pomodoroMinutes;

  @Column(name = "training_ride_minutes")
  private Integer trainingRideMinutes;

  @Column(name = "german_cards_minutes")
  private Integer germanCardsMinutes;

  @Column(name = "reading_minutes")
  private Integer readingMinutes;

  @Column(name = "german_with_wife_minutes")
  private Integer germanWithWifeMinutes;

  @Column(name = "flashcard_creation_minutes")
  private Integer flashcardCreationMinutes;

  @Column(name = "coins_reset_at", nullable = false, insertable = false)
  private ZonedDateTime coinsResetAt;

  @Column(name = "updated_at", nullable = false, insertable = false)
  private ZonedDateTime updatedAt;
}
