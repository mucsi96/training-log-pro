//! Persisted identifiers and UTC timestamp-without-time-zone columns match the
//! deployed schema. No automatic schema synchronization is performed.
macro_rules! entity {
    ($module:ident, $table:literal, {$($(#[$attr:meta])* $field:ident: $ty:ty),* $(,)?}) => {
        pub mod $module {
            use sea_orm::entity::prelude::*;
            #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
            #[sea_orm(table_name = $table)]
            pub struct Model { $($(#[$attr])* pub $field: $ty),* }
            #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
            pub enum Relation {}
            impl ActiveModelBehavior for ActiveModel {}
        }
    };
}

entity!(book, "book", {
    #[sea_orm(primary_key, auto_increment = false)] id: Uuid,
    title: String, author: String, total_pages: Option<i32>, starting_page: i32,
    created_at: DateTime, completed_at: Option<DateTime>
});
entity!(reading_progress, "reading_progress", {
    #[sea_orm(primary_key, auto_increment = false)] id: Uuid,
    book_id: Uuid, current_page: i32, minutes: Option<i32>, created_at: DateTime
});
entity!(daily_task, "daily_task", {
    #[sea_orm(primary_key, auto_increment = false)] id: Uuid,
    name: String, created_at: DateTime
});
entity!(daily_task_completion, "daily_task_completion", {
    #[sea_orm(primary_key, auto_increment = false)] id: Uuid,
    task_id: Uuid, date: Date, completed_at: DateTime
});
entity!(device, "device", {
    #[sea_orm(primary_key, auto_increment = false)] id: Uuid,
    name: String, encrypted_key: String, created_at: DateTime
});
entity!(device_book, "device_book", {
    #[sea_orm(primary_key, auto_increment = false)] id: Uuid,
    device_id: Uuid, file_name: String, content_type: String, data: Vec<u8>, created_at: DateTime
});
entity!(pushup_set, "pushup_set", {
    #[sea_orm(primary_key, auto_increment = false)] created_at: DateTime,
    count: i32
});
entity!(weight, "weight", {
    #[sea_orm(primary_key, auto_increment = false)] created_at: DateTime,
    weight: Option<f32>, fat_ratio: Option<f32>, fat_mass_weight: Option<f32>
});
entity!(ride, "ride", {
    #[sea_orm(primary_key, auto_increment = false)] created_at: DateTime,
    calories: Option<f32>, distance: Option<f32>, moving_time: Option<i32>, name: Option<String>,
    sport_type: Option<String>, total_elevation_gain: Option<f32>, weighted_average_watts: Option<f32>, suffer_score: Option<f32>
});
entity!(fitness, "fitness", {
    #[sea_orm(primary_key, auto_increment = false)] created_at: DateTime,
    fitness: Option<f32>, fatigue: Option<f32>, form: Option<f32>, pulled_at: Option<DateTime>
});
entity!(ftp, "ftp", {
    #[sea_orm(primary_key, auto_increment = false)] created_at: DateTime,
    ftp: f32, weight: f32, ftp_per_kg: f32, pulled_at: DateTime
});
entity!(segment, "segment", {
    #[sea_orm(primary_key, auto_increment = false)] id: i64,
    latitudes: Json, longitudes: Json, distances: Json, altitudes: Json, updated_at: DateTime
});
entity!(segment_effort, "segment_effort", {
    #[sea_orm(primary_key, auto_increment = false)] id: i64,
    segment_id: i64, segment_name: String, segment_distance: f32, segment_average_grade: f32,
    elapsed_time: i32, start_date: DateTime, ride_created_at: DateTime, average_watts: Option<f32>
});
entity!(settings, "settings", {
    #[sea_orm(primary_key, auto_increment = false)] id: i32,
    updated_at: DateTime, coins_reset_at: DateTime
});
entity!(day_goal_requirement, "day_goal_requirement", {
    #[sea_orm(primary_key, auto_increment = false)] id: Uuid,
    tier: String, metric: String, goal: i32
});
entity!(achieved_day, "achieved_day", {
    #[sea_orm(primary_key, auto_increment = false)] date: Date,
    tier: String, achieved_at: DateTime, celebrated_at: Option<DateTime>
});
entity!(oauth2_authorized_client, "oauth2_authorized_client", {
    #[sea_orm(primary_key, auto_increment = false)] client_registration_id: String,
    #[sea_orm(primary_key, auto_increment = false)] principal_name: String,
    access_token_type: String, access_token_value: Vec<u8>, access_token_issued_at: DateTime,
    access_token_expires_at: DateTime, access_token_scopes: Option<String>, refresh_token_value: Option<Vec<u8>>,
    refresh_token_issued_at: Option<DateTime>, created_at: DateTime
});
