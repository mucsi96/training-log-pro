-- Adopt an already migrated database without rewriting data or replaying the
-- historical destructive Liquibase changes. Only empty databases are seeded.
DO $$
BEGIN
  IF to_regclass('training_log.book') IS NOT NULL THEN
    IF to_regclass('training_log.databasechangelog') IS NULL THEN
      RAISE EXCEPTION 'Existing database has no recognized migration history';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM training_log.databasechangelog WHERE id = '37-time-based-reading-goals') THEN
      RAISE EXCEPTION 'Upgrade to the final Spring release before running the Rust server';
    END IF;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'training_log' AND table_name <> 'seaql_migrations') THEN
    RAISE EXCEPTION 'Refusing to initialize a partially populated database';
  END IF;

  CREATE TABLE oauth2_authorized_client (
    client_registration_id varchar(100) NOT NULL, principal_name varchar(200) NOT NULL,
    access_token_type varchar(100) NOT NULL, access_token_value bytea NOT NULL,
    access_token_issued_at timestamp NOT NULL, access_token_expires_at timestamp NOT NULL,
    access_token_scopes varchar(1000), refresh_token_value bytea, refresh_token_issued_at timestamp,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (client_registration_id, principal_name)
  );
  CREATE TABLE ride (created_at timestamp(6) PRIMARY KEY, calories real, distance real,
    moving_time integer, name varchar(255), sport_type varchar(255), total_elevation_gain real,
    weighted_average_watts real, suffer_score real);
  CREATE TABLE weight (created_at timestamp(6) PRIMARY KEY, weight real, fat_ratio real, fat_mass_weight real);
  CREATE TABLE fitness (created_at timestamp(6) PRIMARY KEY, fatigue real, fitness real, form real, pulled_at timestamp(6));
  CREATE TABLE ftp (created_at timestamp(6) PRIMARY KEY, pulled_at timestamp(6) NOT NULL,
    ftp real NOT NULL, weight real NOT NULL, ftp_per_kg real NOT NULL);
  CREATE TABLE pushup_set (created_at timestamp(6) PRIMARY KEY, count integer NOT NULL);
  CREATE TABLE settings (id integer PRIMARY KEY, updated_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    coins_reset_at timestamp(6) NOT NULL DEFAULT '1970-01-01');
  INSERT INTO settings(id) VALUES (1);
  CREATE TABLE achieved_day (date date PRIMARY KEY, achieved_at timestamp(6) NOT NULL,
    celebrated_at timestamp(6), tier varchar(16) NOT NULL);
  CREATE TABLE segment_effort (id bigint PRIMARY KEY, segment_id bigint NOT NULL,
    segment_name varchar(255) NOT NULL, segment_distance real NOT NULL, segment_average_grade real NOT NULL,
    elapsed_time integer NOT NULL, start_date timestamp(6) NOT NULL, ride_created_at timestamp(6) NOT NULL, average_watts real);
  CREATE INDEX idx_segment_effort_segment_id ON segment_effort(segment_id);
  CREATE INDEX idx_segment_effort_start_date ON segment_effort(start_date);
  CREATE TABLE segment (id bigint PRIMARY KEY, latitudes jsonb NOT NULL, longitudes jsonb NOT NULL,
    distances jsonb NOT NULL, altitudes jsonb NOT NULL, updated_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE book (id uuid PRIMARY KEY, title varchar(255) NOT NULL, author varchar(255) NOT NULL,
    total_pages integer, starting_page integer NOT NULL DEFAULT 0, created_at timestamp(6) NOT NULL, completed_at timestamp(6));
  CREATE TABLE reading_progress (id uuid PRIMARY KEY, created_at timestamp(6) NOT NULL,
    book_id uuid NOT NULL REFERENCES book(id), current_page integer NOT NULL,
    minutes integer CONSTRAINT reading_progress_minutes_check CHECK (minutes BETWEEN 1 AND 1440));
  CREATE INDEX idx_reading_progress_book_id ON reading_progress(book_id);
  CREATE INDEX idx_reading_progress_created_at ON reading_progress(created_at);
  CREATE TABLE daily_task (id uuid PRIMARY KEY, name varchar(255) NOT NULL, created_at timestamp(6) NOT NULL);
  CREATE TABLE daily_task_completion (id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES daily_task(id),
    date date NOT NULL, completed_at timestamp(6) NOT NULL, CONSTRAINT uq_daily_task_completion_task_date UNIQUE(task_id,date));
  CREATE INDEX idx_daily_task_completion_date ON daily_task_completion(date);
  CREATE TABLE device (id uuid PRIMARY KEY, name varchar(255) NOT NULL, encrypted_key varchar(255) NOT NULL, created_at timestamp(6) NOT NULL);
  CREATE TABLE device_book (id uuid PRIMARY KEY, device_id uuid NOT NULL REFERENCES device(id),
    file_name varchar(255) NOT NULL, content_type varchar(255) NOT NULL, data bytea NOT NULL, created_at timestamp(6) NOT NULL);
  CREATE INDEX idx_device_book_device_id ON device_book(device_id);
  CREATE TABLE day_goal_requirement (id uuid PRIMARY KEY, tier varchar(16) NOT NULL,
    metric varchar(32) NOT NULL, goal integer NOT NULL, CONSTRAINT day_goal_requirement_tier_metric_key UNIQUE(tier,metric));
  INSERT INTO day_goal_requirement VALUES
    (gen_random_uuid(),'GOLD','PUSHUPS',100), (gen_random_uuid(),'GOLD','ELEVATION',250);
END $$;
