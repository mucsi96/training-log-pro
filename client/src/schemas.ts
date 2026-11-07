import { z } from 'zod';

export const environmentSchema = z.object({ thunderforestApiKey: z.string() });
export const profileSchema = z.object({
  email: z.string(),
  preferredUsername: z.string().optional(),
  additionalClaims: z.object({ name: z.string().optional() }).optional(),
});
export const coinsSchema = z.object({ totalCoins: z.number(), totalPoints: z.number(), pointsPerCoin: z.number() });
export const tierSchema = z.enum(['GOLD', 'SILVER', 'BRONZE']);
export const metricSchema = z.enum(['PUSHUPS', 'ELEVATION', 'READING_MINUTES', 'DAILY_TASKS']);
const goalSchema = z.object({ metric: metricSchema, required: z.boolean(), goal: z.number().nullable() });
export const settingsSchema = z.object({ tiers: z.array(z.object({ tier: tierSchema, goals: z.array(goalSchema) })) });
export type Settings = z.infer<typeof settingsSchema>;
export const dayGoalSchema = settingsSchema.extend({
  todayTier: tierSchema.nullable(),
  nextTier: tierSchema.nullable(),
  celebrateToday: z.boolean(),
  currentStreak: z.number(),
  monthCounts: z.array(z.object({ tier: tierSchema, count: z.number() })),
  todayProgress: z.array(z.object({ metric: metricSchema, value: z.number() })),
});
export const taskSchema = z.object({ id: z.string(), name: z.string() });
export const tasksSchema = z.array(taskSchema);
export const todayTasksSchema = z.array(taskSchema.extend({ completed: z.boolean() }));
export const bookSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  totalPages: z.number().nullish(),
  startingPage: z.number(),
  currentPage: z.number(),
  createdAt: z.string(),
  startedAt: z.string().nullish(),
  completedAt: z.string().nullish(),
  averagePagesPerDay: z.number().nullish(),
  estimatedDaysRemaining: z.number().nullish(),
});
export const booksSchema = z.array(bookSchema);
export type Book = z.infer<typeof bookSchema>;
export const pushupSchema = z.object({ count: z.number(), createdAt: z.string() });
export const pushupsSchema = z.array(pushupSchema);
const deviceBookSchema = z.object({ id: z.string(), fileName: z.string(), createdAt: z.string() });
export const devicesSchema = z.array(
  z.object({ id: z.string(), name: z.string(), createdAt: z.string(), books: z.array(deviceBookSchema) })
);
export const createdDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiKey: z.string(),
  createdAt: z.string(),
});
export const rideSchema = z.object({
  calories: z.number().optional(),
  elevationGain: z.number().optional(),
  distance: z.number().optional(),
  time: z.number().optional(),
});
const weightSchema = z.object({
  date: z.string(),
  weight: z.number(),
  fatRatio: z.number().nullish(),
  fatMassWeight: z.number().nullish(),
});
export const weightHistorySchema = z.object({ measurements: z.array(weightSchema), baseline: weightSchema.nullish() });
export const fitnessSchema = z.object({
  measurements: z.array(z.object({ date: z.string(), fitness: z.number(), fatigue: z.number(), form: z.number() })),
});
export const ftpSchema = z.object({
  measurements: z.array(z.object({ date: z.string(), ftp: z.number(), weight: z.number(), ftpPerKg: z.number() })),
});
export const podiumSchema = z
  .object({
    segmentName: z.string(),
    segmentUrl: z.string(),
    period: z.enum(['WEEK', 'MONTH', 'ALL_TIME']),
    position: z.number(),
    message: z.string(),
    distance: z.number(),
    elapsedTime: z.number(),
    averageGrade: z.number(),
    elevationGain: z.number(),
    averageWatts: z.number().nullish(),
    averageWattsPerKg: z.number().nullish(),
    fasterPosition: z.number().nullish(),
    gapToFaster: z.number().nullish(),
    fasterStartDate: z.string().nullish(),
    slowerPosition: z.number().nullish(),
    gapToSlower: z.number().nullish(),
    slowerStartDate: z.string().nullish(),
    latitudes: z.array(z.number()).nullish(),
    longitudes: z.array(z.number()).nullish(),
    distances: z.array(z.number()).nullish(),
    altitudes: z.array(z.number()).nullish(),
  })
  .optional()
  .transform((value) => value ?? null);
export type Podium = NonNullable<z.infer<typeof podiumSchema>>;
export const emptySchema = z.unknown().transform(() => undefined);
