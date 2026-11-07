import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '@mucsi96/react-ui';
import { send, useApi } from './api';
import { dayGoalSchema, emptySchema } from './schemas';
import { tiers, metrics } from './format';
import { QueryState } from './QueryState';
import styles from './DayGoal.module.css';

export function DayGoal() {
  const query = useApi('/api/day-goal', dayGoalSchema, 'strava');
  const client = useQueryClient();
  const notifications = useNotifications();
  const celebrated = useRef<string | null>(null);
  useEffect(() => {
    if (!query.data) return;
    void client.invalidateQueries({ queryKey: ['/api/coins'] });
    const achievement = `${new Date().toDateString()}:${query.data.todayTier}`;
    if (query.data.celebrateToday && celebrated.current !== achievement) {
      celebrated.current = achievement;
      void send('/api/day-goal/celebrate', emptySchema, 'POST').catch((error) => {
        if (celebrated.current === achievement) celebrated.current = null;
        notifications.error(error.message);
      });
    }
  }, [query.data, client, notifications]);
  return (
    <section className={styles.card} aria-label="Day goal">
      <h2>Day goal</h2>
      <QueryState query={query}>
        {(stats) => (
          <>
            {stats.todayTier && (
              <p className={styles.achieved} style={{ color: tiers[stats.todayTier].color }}>
                Today is a {tiers[stats.todayTier].label.toLowerCase()} day
              </p>
            )}
            <div className={styles.counts}>
              {stats.monthCounts.map((item) => (
                <div key={item.tier}>
                  <span style={{ color: tiers[item.tier].color }}>{item.count}</span>
                  <small>{tiers[item.tier].label} this month</small>
                </div>
              ))}
              <div>
                <span>{stats.currentStreak}</span>
                <small>Streak</small>
              </div>
            </div>
            {stats.nextTier ? (
              <div className={styles.progress}>
                <span>Next: {tiers[stats.nextTier].label.toLowerCase()}</span>
                {stats.tiers
                  .find((tier) => tier.tier === stats.nextTier)!
                  .goals.filter((goal) => goal.required && goal.goal !== null)
                  .map((goal) => (
                    <span key={goal.metric}>
                      {Math.round(stats.todayProgress.find((item) => item.metric === goal.metric)!.value)}/{goal.goal}{' '}
                      {metrics[goal.metric].unit}
                    </span>
                  ))}
              </div>
            ) : (
              !stats.todayTier && <p>No tier has requirements yet. Configure them in settings.</p>
            )}
            {stats.celebrateToday && (
              <div key={stats.todayTier} className={styles.confetti} aria-hidden="true">
                {Array.from({ length: 24 }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      left: `${i * 4}%`,
                      animationDelay: `${(i % 5) * 0.12}s`,
                      background: ['#facb2e', '#66bb6a', '#55aaff'][i % 3],
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </QueryState>
    </section>
  );
}
