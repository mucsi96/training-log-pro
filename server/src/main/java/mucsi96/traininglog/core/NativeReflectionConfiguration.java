package mucsi96.traininglog.core;

import org.springframework.aot.hint.annotation.RegisterReflectionForBinding;
import org.springframework.context.annotation.Configuration;

import mucsi96.traininglog.strava.StravaAltitudeStream;
import mucsi96.traininglog.strava.StravaDetailedActivity;
import mucsi96.traininglog.strava.StravaDistanceStream;
import mucsi96.traininglog.strava.StravaLatLngStream;
import mucsi96.traininglog.strava.StravaSegment;
import mucsi96.traininglog.strava.StravaSegmentEffort;
import mucsi96.traininglog.strava.StravaStreamSet;
import mucsi96.traininglog.strava.StravaSummaryActivity;
import mucsi96.traininglog.strava.StravaSummaryActivityAthlete;
import mucsi96.traininglog.withings.WithingsGetAccessTokenResponse;
import mucsi96.traininglog.withings.WithingsGetAccessTokenResponseBody;
import mucsi96.traininglog.withings.WithingsGetMeasureResponse;
import mucsi96.traininglog.withings.WithingsGetMeasureResponseBody;
import mucsi96.traininglog.withings.WithingsMeasure;
import mucsi96.traininglog.withings.WithingsMeasureGroup;

/**
 * GraalVM native image reflection hints for the generated Strava and Withings
 * API models. These are deserialized with hand-built RestTemplate/ObjectMapper
 * calls inside services, so Spring AOT cannot discover them from controller
 * signatures the way it does for the mucsi96.traininglog.api models.
 */
@Configuration
@RegisterReflectionForBinding({
    StravaSummaryActivity.class,
    StravaSummaryActivityAthlete.class,
    StravaDetailedActivity.class,
    StravaSegmentEffort.class,
    StravaSegment.class,
    StravaStreamSet.class,
    StravaDistanceStream.class,
    StravaAltitudeStream.class,
    StravaLatLngStream.class,
    WithingsGetAccessTokenResponse.class,
    WithingsGetAccessTokenResponseBody.class,
    WithingsGetMeasureResponse.class,
    WithingsGetMeasureResponseBody.class,
    WithingsMeasureGroup.class,
    WithingsMeasure.class
})
public class NativeReflectionConfiguration {
}
