import { lazy, Suspense, useState } from 'react';
import { useApi } from './api';
import { podiumSchema } from './schemas';
import { duration, measurement, position, relativeDate } from './format';
import { QueryState } from './QueryState';
import { LoadingArea } from '@mucsi96/react-ui';
import { Chart } from './Chart';
import styles from './Podium.module.css';

const RouteMap = lazy(() => import('./RouteMap'));
export function PodiumBanner() {
  const query = useApi('/api/ride/podium', podiumSchema, 'strava');
  const [expanded, setExpanded] = useState(false);
  return (
    <QueryState query={query} label="Loading podium">
      {(podium) =>
        podium && (
          <section
            className={styles.panel}
            data-testid="podium-banner"
            data-period={podium.period}
            data-position={podium.position}
            aria-label={podium.message}
          >
            <header>
              <span aria-hidden="true">🏆</span>
              <div>
                <p>{podium.message}</p>
                <p>{podium.segmentName}</p>
              </div>
            </header>
            <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
              <summary>Segment details &amp; route</summary>
              <dl className={styles.stats}>
                {[
                  ['Length', 'distance', measurement(podium.distance, 'km', 2, 1000)],
                  ['Time', 'time', duration(podium.elapsedTime)],
                  ['Elevation', 'elevation', measurement(podium.elevationGain, 'm')],
                  ...(podium.averageWatts ? [['Avg watts', 'watts', measurement(podium.averageWatts, 'W')]] : []),
                  ...(podium.averageWattsPerKg
                    ? [['Watts / kg', 'watts-per-kg', `${podium.averageWattsPerKg.toFixed(1)} W/kg`]]
                    : []),
                ].map(([label, id, value]) => (
                  <div key={id}>
                    <dt>{label}</dt>
                    <dd data-testid={`podium-${id}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              {expanded && podium.latitudes?.length && podium.longitudes?.length ? (
                <Suspense fallback={<LoadingArea label="Loading route map" />}>
                  <RouteMap latitudes={podium.latitudes} longitudes={podium.longitudes} />
                  {podium.distances?.length && podium.altitudes?.length ? (
                    <div data-testid="podium-elevation-chart">
                      <Chart
                        option={{
                          aria: { enabled: true, label: { description: 'Segment elevation profile' } },
                          animation: false,
                          grid: { top: 8, right: 8, bottom: 8, left: 8 },
                          xAxis: { type: 'value', show: false, min: 'dataMin', max: 'dataMax' },
                          yAxis: { type: 'value', show: false, scale: true },
                          series: [
                            {
                              type: 'line',
                              smooth: true,
                              showSymbol: false,
                              data: podium.distances.map((distance, i) => [distance / 1000, podium.altitudes![i]]),
                              lineStyle: { color: '#ffd700', width: 2 },
                              areaStyle: { color: 'rgba(255,215,0,.18)' },
                            },
                          ],
                        }}
                      />
                    </div>
                  ) : null}
                </Suspense>
              ) : null}
              <ul className={styles.gaps}>
                {(['faster', 'slower'] as const).map((kind) => {
                  const gap = kind === 'faster' ? podium.gapToFaster : podium.gapToSlower;
                  const rank = kind === 'faster' ? podium.fasterPosition : podium.slowerPosition;
                  const date = kind === 'faster' ? podium.fasterStartDate : podium.slowerStartDate;
                  return (
                    gap != null &&
                    rank != null && (
                      <li key={kind} data-testid={`podium-gap-${kind}`}>
                        <span>{position(rank)} place</span>
                        <span>
                          {kind === 'faster' ? '-' : '+'}
                          {duration(gap)}
                        </span>
                        {date && (
                          <time dateTime={date} title={new Date(date).toLocaleString()}>
                            {relativeDate(date)}
                          </time>
                        )}
                      </li>
                    )
                  );
                })}
              </ul>
            </details>
          </section>
        )
      }
    </QueryState>
  );
}
