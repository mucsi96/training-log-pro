use crate::error::{Error, Result};
use axum::http::HeaderMap;
use chrono::{DateTime, FixedOffset, NaiveDate, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;

pub fn now() -> NaiveDateTime {
    Utc::now().naive_utc()
}
pub fn zone(headers: &HeaderMap) -> Result<Tz> {
    headers
        .get("X-Timezone")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
        .ok_or_else(|| Error::BadRequest("A valid X-Timezone header is required".into()))
}
pub fn local(at: NaiveDateTime, zone: Tz) -> DateTime<FixedOffset> {
    at.and_utc().with_timezone(&zone).fixed_offset()
}
pub fn today(zone: Tz) -> NaiveDate {
    Utc::now().with_timezone(&zone).date_naive()
}
pub fn start(day: NaiveDate, zone: Tz) -> Result<NaiveDateTime> {
    zone.from_local_datetime(&day.and_hms_opt(0, 0, 0).expect("midnight"))
        .earliest()
        .map(|v| v.naive_utc())
        .ok_or_else(|| Error::BadRequest("Date has no midnight in this timezone".into()))
}
pub fn range(period: Option<u32>, zone: Tz) -> Result<(Option<NaiveDateTime>, NaiveDateTime)> {
    let today = today(zone);
    let end = start(today.succ_opt().expect("valid date"), zone)?;
    let begin = period
        .map(|days| {
            crate::error::require(days > 0, "period must be positive")?;
            let day = today
                .checked_sub_signed(chrono::Duration::days(i64::from(days) - 1))
                .ok_or_else(|| Error::BadRequest("period is too large".into()))?;
            start(day, zone)
        })
        .transpose()?;
    Ok((begin, end))
}
