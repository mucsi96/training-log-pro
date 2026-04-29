import { Request, Response } from 'express';

type PushedSegmentEffort = {
  id: number;
  segmentId: number;
  segmentName: string;
  segmentDistance: number;
  segmentAverageGrade: number;
  elapsedTime: number;
};

type PushedActivity = {
  id: number;
  totalElevationGain: number;
  sufferScore: number | null;
  distance: number;
  movingTime: number;
  calories: number;
  averageWatts: number;
  weightedAverageWatts: number;
  name: string;
  sportType: string;
  segmentEfforts: PushedSegmentEffort[];
};

const DEFAULT_SUFFER_SCORES = [82, 162];

let activities: PushedActivity[] = [];
let nextId = 1;
const startDateById = new Map<number, string>();

export function pushActivity(req: Request, res: Response) {
  const body = req.body ?? {};
  const id = nextId++;
  const segmentEfforts: PushedSegmentEffort[] = (body.segmentEfforts ?? []).map(
    (effort: Partial<PushedSegmentEffort>, index: number) => ({
      id: effort.id ?? id * 1000 + index,
      segmentId: effort.segmentId ?? index + 1,
      segmentName: effort.segmentName ?? `Segment ${index + 1}`,
      segmentDistance: effort.segmentDistance ?? 500,
      segmentAverageGrade: effort.segmentAverageGrade ?? 4,
      elapsedTime: effort.elapsedTime ?? 120,
    })
  );

  const activity: PushedActivity = {
    id,
    totalElevationGain: body.totalElevationGain ?? 516,
    sufferScore:
      body.sufferScore === null
        ? null
        : body.sufferScore ?? DEFAULT_SUFFER_SCORES[(id - 1) % DEFAULT_SUFFER_SCORES.length],
    distance: body.distance ?? 28099,
    movingTime: body.movingTime ?? 4207,
    calories: body.calories ?? 870.2,
    averageWatts: body.averageWatts ?? 185.5,
    weightedAverageWatts: body.weightedAverageWatts ?? 230,
    name: body.name ?? `Test activity ${id}`,
    sportType: body.sportType ?? 'MountainBikeRide',
    segmentEfforts,
  };
  activities.push(activity);
  console.log('[pushActivity] Stored activity', activity);
  res.json(activity);
}

export function resetActivities(req: Request, res: Response) {
  activities = [];
  nextId = 1;
  startDateById.clear();
  console.log('[resetActivities] Cleared all pushed activities');
  res.json({ count: 0 });
}

export function getActivities(req: Request, res: Response) {
  const authorization = req.headers.authorization;
  const after = req.query.after as string | undefined;
  const before = req.query.before as string | undefined;

  console.log('[getActivities] Parameters:', {
    authorization,
    after,
    before,
    pushedCount: activities.length,
  });

  if (authorization !== 'Bearer test-access-token') {
    console.error(`[getActivities] Invalid authorization: "${authorization}", expected "Bearer test-access-token"`);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!after || isNaN(parseInt(after))) {
    console.error(`[getActivities] Invalid after: "${after}"`);
    res.status(400).json({ error: `Invalid after parameter: "${after}"` });
    return;
  }

  if (!before || isNaN(parseInt(before))) {
    console.error(`[getActivities] Invalid before: "${before}"`);
    res.status(400).json({ error: `Invalid before parameter: "${before}"` });
    return;
  }

  const afterTs = parseInt(after);
  const beforeTs = parseInt(before);
  const middayTs = afterTs + (beforeTs - afterTs) / 2;

  const response = activities.map((activity, index) => {
    const startDate = new Date(1000 * middayTs);
    startDate.setUTCHours(12, 35 + index * 10);
    const startDateIso = startDate.toISOString();
    startDateById.set(activity.id, startDateIso);

    return {
      resource_state: 2,
      athlete: { id: 134815, resource_state: 1 },
      name: activity.name,
      distance: activity.distance,
      moving_time: activity.movingTime,
      elapsed_time: activity.movingTime,
      total_elevation_gain: activity.totalElevationGain,
      type: 'Ride',
      sport_type: activity.sportType,
      workout_type: null,
      id: activity.id,
      external_id: `garmin_push_${activity.id}`,
      upload_id: activity.id,
      start_date: startDateIso,
      start_date_local: startDateIso,
      timezone: '(GMT-08:00) America/Los_Angeles',
      utc_offset: -25200,
      start_latlng: null,
      end_latlng: null,
      location_city: null,
      location_state: null,
      location_country: 'United States',
      achievement_count: 0,
      kudos_count: 0,
      comment_count: 0,
      athlete_count: 1,
      photo_count: 0,
      map: { id: `m${activity.id}`, summary_polyline: null, resource_state: 2 },
      trainer: true,
      commute: false,
      manual: false,
      private: false,
      flagged: false,
      gear_id: 'b1',
      from_accepted_tag: false,
      average_speed: 5.54,
      max_speed: 11,
      average_cadence: 67.1,
      average_watts: activity.averageWatts,
      weighted_average_watts: activity.weightedAverageWatts,
      kilojoules: 788.7,
      device_watts: true,
      has_heartrate: true,
      average_heartrate: 140.3,
      max_heartrate: 178,
      max_watts: 406,
      pr_count: 0,
      total_photo_count: 0,
      has_kudoed: false,
      suffer_score: activity.sufferScore,
    };
  });

  console.log('[getActivities] Returning', response.length, 'activities');
  res.json(response);
}

export function getActivity(req: Request, res: Response) {
  const authorization = req.headers.authorization;
  const idParam = req.params.id as string;

  console.log('[getActivity] Parameters:', {
    authorization,
    id: idParam,
  });

  if (authorization !== 'Bearer test-access-token') {
    console.error(`[getActivity] Invalid authorization: "${authorization}", expected "Bearer test-access-token"`);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const id = parseInt(idParam);
  if (!idParam || isNaN(id)) {
    console.error(`[getActivity] Invalid activity id: "${idParam}"`);
    res.status(400).json({ error: `Invalid activity id: "${idParam}"` });
    return;
  }

  const activity = activities.find((a) => a.id === id);
  if (!activity) {
    console.error(`[getActivity] Activity ${id} not found`);
    res.status(404).json({ error: `Activity ${id} not found` });
    return;
  }

  const startDate = startDateById.get(activity.id) ?? new Date().toISOString();

  const response = {
    id: activity.id,
    resource_state: 3,
    external_id: `garmin_push_${activity.id}`,
    upload_id: activity.id,
    athlete: { id: 134815, resource_state: 1 },
    name: activity.name,
    distance: activity.distance,
    moving_time: activity.movingTime,
    elapsed_time: activity.movingTime,
    type: 'Ride',
    sport_type: activity.sportType,
    start_date: startDate,
    start_date_local: startDate,
    timezone: '(GMT-08:00) America/Los_Angeles',
    utc_offset: -28800,
    start_latlng: [37.83, -122.26],
    end_latlng: [37.83, -122.26],
    achievement_count: 0,
    kudos_count: 0,
    comment_count: 0,
    athlete_count: 1,
    photo_count: 0,
    total_elevation_gain: activity.totalElevationGain,
    trainer: false,
    commute: false,
    manual: false,
    private: false,
    flagged: false,
    gear_id: 'b1',
    from_accepted_tag: false,
    average_speed: 6.679,
    max_speed: 18.5,
    average_cadence: 78.5,
    average_temp: 4,
    average_watts: activity.averageWatts,
    weighted_average_watts: activity.weightedAverageWatts,
    kilojoules: 780.5,
    device_watts: true,
    has_heartrate: false,
    max_watts: 743,
    elev_high: 446.6,
    elev_low: 17.2,
    pr_count: 0,
    total_photo_count: 0,
    has_kudoed: false,
    workout_type: 10,
    suffer_score: activity.sufferScore,
    description: '',
    calories: activity.calories,
    gear: {
      id: 'b1',
      primary: true,
      name: 'Tarmac',
      resource_state: 2,
      distance: 32547610,
    },
    partner_brand_tag: null,
    hide_from_home: false,
    device_name: 'Garmin Edge 1030',
    embed_token: 'embed-token',
    segment_leaderboard_opt_out: false,
    leaderboard_opt_out: false,
    segment_efforts: activity.segmentEfforts.map((effort, index) => {
      const effortStart = new Date(startDate);
      effortStart.setUTCMinutes(effortStart.getUTCMinutes() + index);
      return {
        id: effort.id,
        resource_state: 2,
        name: effort.segmentName,
        elapsed_time: effort.elapsedTime,
        moving_time: effort.elapsedTime,
        start_date: effortStart.toISOString(),
        start_date_local: effortStart.toISOString(),
        distance: effort.segmentDistance,
        segment: {
          id: effort.segmentId,
          resource_state: 2,
          name: effort.segmentName,
          activity_type: 'Ride',
          distance: effort.segmentDistance,
          average_grade: effort.segmentAverageGrade,
          maximum_grade: effort.segmentAverageGrade + 2,
          elevation_high: 200,
          elevation_low: 100,
          climb_category: 0,
          city: null,
          state: null,
          country: null,
          private: false,
          hazardous: false,
          starred: false,
        },
        kom_rank: null,
        pr_rank: null,
        achievements: [],
      };
    }),
  };

  console.log(`[getActivity] Returning activity ${id} with start_date: ${startDate}`);
  res.json(response);
}
