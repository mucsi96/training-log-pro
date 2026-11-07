import { periodPath, useApi } from './api';
import type { z } from 'zod';
import { fitnessSchema, ftpSchema, rideSchema, weightHistorySchema } from './schemas';
import { difference, measurement, number } from './format';
import { QueryState } from './QueryState';
import { Chart } from './Chart';
import { PodiumBanner } from './Podium';
import styles from './Measurements.module.css';

function Diff({
  value,
  unit = '',
  inverse = false,
  today = false,
}: {
  value: number | undefined;
  unit?: string;
  inverse?: boolean;
  today?: boolean;
}) {
  const color = value === undefined || value === 0 ? '' : value > 0 !== inverse ? styles.green : styles.red;
  return (
    <span
      aria-label={today ? 'Today change' : 'Period change'}
      className={`${today ? styles.todayDiff : styles.periodValue} ${color}`}
    >
      {difference(value, unit)}
    </span>
  );
}

function TrainingMetric({ period, kind }: { period: number; kind: 'fitness' | 'ftp' }) {
  const schema: z.ZodType<z.infer<typeof fitnessSchema> | z.infer<typeof ftpSchema>> =
    kind === 'fitness' ? fitnessSchema : ftpSchema;
  const recent = useApi(periodPath(`/api/${kind}`, 2), schema, 'strava');
  const history = useApi(periodPath(`/api/${kind}`, period), schema, 'strava');
  const title = kind === 'fitness' ? 'Fitness' : 'FTP/kg';
  const valueOf = (value: { fitness: number } | { ftpPerKg: number }) =>
    'fitness' in value ? value.fitness : value.ftpPerKg;
  return (
    <QueryState query={recent}>
      {(recentData) => (
        <QueryState query={history}>
          {(data) => {
            const latest = recentData.measurements.at(-1);
            if (!latest) return null;
            const previous = recentData.measurements.at(-2);
            const first = data.measurements[0];
            const last = data.measurements.at(-1);
            return (
              <section className={styles.card} aria-label={title}>
                <h2>{title}</h2>
                <p className={styles.value}>
                  {number(valueOf(latest), kind === 'ftp' ? 2 : 0)}{' '}
                  {previous && <Diff value={valueOf(latest) - valueOf(previous)} today />}
                </p>
                <Diff value={first && last && first !== last ? valueOf(last) - valueOf(first) : undefined} />
                <Chart
                  option={{
                    aria: { enabled: true },
                    animation: false,
                    grid: { top: 10, right: 10, bottom: 10, left: 10 },
                    xAxis: { type: 'time', show: false },
                    yAxis: { type: 'value', show: false },
                    series: [
                      {
                        name: title,
                        type: 'line',
                        smooth: true,
                        showSymbol: false,
                        data: data.measurements.map((item) => [new Date(item.date).getTime(), valueOf(item)]),
                      },
                    ],
                  }}
                />
              </section>
            );
          }}
        </QueryState>
      )}
    </QueryState>
  );
}

export function Training({ period }: { period: number }) {
  const today = useApi(periodPath('/api/ride/stats', 1), rideSchema, 'strava');
  const history = useApi(periodPath('/api/ride/stats', period), rideSchema, 'strava');
  return (
    <>
      <PodiumBanner />
      <QueryState query={today}>
        {(current) => (
          <QueryState query={history}>
            {(stats) =>
              (stats.time ?? 0) > 0 && (
                <div className={styles.grid}>
                  {(
                    [
                      ['Calories', 'calories', '', 1],
                      ['Elevation gain', 'elevationGain', 'm', 1],
                      ['Distance', 'distance', 'km', 1000],
                      ['Time', 'time', 'min', 60],
                    ] as const
                  ).map(([label, key, unit, divisor]) => (
                    <article key={key} className={styles.card}>
                      <h2>{label}</h2>
                      <p className={styles.value}>{measurement(current[key], unit, 0, divisor)}</p>
                      <p className={styles.periodValue}>{measurement(stats[key], unit, 0, divisor)}</p>
                    </article>
                  ))}
                </div>
              )
            }
          </QueryState>
        )}
      </QueryState>
      <div className={styles.grid}>
        <TrainingMetric kind="fitness" period={period} />
        <TrainingMetric kind="ftp" period={period} />
      </div>
    </>
  );
}

export function Health({ period }: { period: number }) {
  const recent = useApi(periodPath('/api/weight', 1), weightHistorySchema, 'withings');
  const history = useApi(periodPath('/api/weight', period), weightHistorySchema, 'withings');
  return (
    <QueryState query={recent}>
      {(today) => (
        <QueryState query={history}>
          {(data) => {
            const latest = today.measurements.at(-1) ?? today.baseline;
            if (!latest) return <p>No weight measurements yet.</p>;
            const initial = data.baseline ?? data.measurements[0];
            const last = data.measurements.at(-1);
            const chartData = data.baseline ? [data.baseline, ...data.measurements] : data.measurements;
            const references = new Set([
              0,
              chartData.length - 1,
              chartData.reduce((i, item, j) => (item.weight < chartData[i].weight ? j : i), 0),
              chartData.reduce((i, item, j) => (item.weight > chartData[i].weight ? j : i), 0),
            ]);
            return (
              <section aria-label="Weight measurements" className={styles.card}>
                <div className={styles.grid}>
                  {(
                    [
                      ['Weight', 'weight', 'kg'],
                      ['Body fat', 'fatMassWeight', 'kg'],
                      ['Fat ratio', 'fatRatio', '%'],
                    ] as const
                  ).map(
                    ([label, key, unit]) =>
                      latest[key] != null && (
                        <article key={key}>
                          <h2>{label}</h2>
                          <p className={styles.value}>
                            <span>{measurement(latest[key], unit, 1)}</span>{' '}
                            {today.measurements.length > 0 && today.baseline?.[key] != null && (
                              <Diff value={latest[key]! - today.baseline[key]!} unit={unit} inverse today />
                            )}
                          </p>
                          {key === 'weight' && today.measurements.length === 0 && (
                            <p className={styles.date}>Last measured {new Date(latest.date).toLocaleDateString()}</p>
                          )}
                          <Diff
                            value={
                              initial?.[key] != null && last?.[key] != null && initial !== last
                                ? last[key]! - initial[key]!
                                : undefined
                            }
                            unit={unit}
                            inverse
                          />
                        </article>
                      )
                  )}
                </div>
                {data.measurements.length > 0 && (
                  <Chart
                    option={{
                      aria: { enabled: true },
                      animation: false,
                      grid: { top: 24, right: 32, bottom: 24, left: 32 },
                      dataset: {
                        source: [
                          ['date', 'weight'],
                          ...chartData.map((item) => [new Date(item.date).getTime(), item.weight]),
                        ],
                      },
                      xAxis: { type: 'time', show: false },
                      yAxis: { max: 'dataMax', min: 'dataMin', show: false },
                      series: [
                        {
                          type: 'line',
                          smooth: true,
                          showSymbol: true,
                          symbolSize: (_value, params) => (references.has(params.dataIndex) ? 5 : 0),
                          label: {
                            show: true,
                            color: '#ddd',
                            fontSize: 11,
                            formatter: (params) =>
                              references.has(params.dataIndex) ? `${chartData[params.dataIndex].weight} kg` : '',
                          },
                          labelLayout: { moveOverlap: 'shiftY' },
                        },
                      ],
                    }}
                  />
                )}
              </section>
            );
          }}
        </QueryState>
      )}
    </QueryState>
  );
}
