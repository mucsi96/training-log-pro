export type DayGoalTier = 'GOLD' | 'SILVER' | 'BRONZE';

export type DayGoalMetric = 'PUSHUPS' | 'ELEVATION' | 'READING_PAGES' | 'DAILY_TASKS';

export type MetricGoal = {
  readonly metric: DayGoalMetric;
  readonly required: boolean;
  readonly goal: number | null;
};

export type RequiredMetricGoal = MetricGoal & { readonly goal: number };

export type TierGoals = {
  readonly tier: DayGoalTier;
  readonly goals: MetricGoal[];
};

export type TierCount = {
  readonly tier: DayGoalTier;
  readonly count: number;
};

export type MetricValue = {
  readonly metric: DayGoalMetric;
  readonly value: number;
};

export type DayGoalStats = {
  readonly todayTier: DayGoalTier | null;
  readonly nextTier: DayGoalTier | null;
  readonly celebrateToday: boolean;
  readonly currentStreak: number;
  readonly monthCounts: TierCount[];
  readonly todayProgress: MetricValue[];
  readonly tiers: TierGoals[];
};

export const TIERS: Record<DayGoalTier, { readonly label: string; readonly color: string }> = {
  GOLD: { label: 'Gold', color: 'hsl(45, 95%, 58%)' },
  SILVER: { label: 'Silver', color: 'hsl(210, 10%, 75%)' },
  BRONZE: { label: 'Bronze', color: 'hsl(28, 65%, 52%)' },
};

export const METRICS: Record<DayGoalMetric, { readonly label: string; readonly unit: string }> = {
  PUSHUPS: { label: 'Pushups', unit: 'pushups' },
  ELEVATION: { label: 'Ride elevation', unit: 'm' },
  READING_PAGES: { label: 'Reading', unit: 'pages' },
  DAILY_TASKS: { label: 'Daily tasks', unit: 'tasks' },
};

export const isRequired = (goal: MetricGoal): goal is RequiredMetricGoal =>
  goal.required && goal.goal !== null;

export const goalsOf = (tiers: TierGoals[], tier: DayGoalTier): TierGoals => {
  const found = tiers.find((candidate) => candidate.tier === tier);
  if (!found) {
    throw new Error(`Tier ${tier} is not configured`);
  }
  return found;
};

/** The goal every tier requiring the metric sets for it. */
export const metricGoals = (tiers: TierGoals[], metric: DayGoalMetric) =>
  tiers.flatMap((tier) =>
    tier.goals
      .filter(isRequired)
      .filter((goal) => goal.metric === metric)
      .map((goal) => ({ tier: tier.tier, goal: goal.goal }))
  );
