import { useState } from 'react';
import { Button, Dialog, DialogTrigger, DonutSlider } from '@mucsi96/react-ui';
import { periodPath, send, useAction, useApi } from './api';
import { pushupSchema, pushupsSchema, settingsSchema } from './schemas';
import { tiers } from './format';
import { QueryState } from './QueryState';
import { Chart } from './Chart';
import styles from './Pushups.module.css';

export function Pushups({ period, compact = false }: { period: number; compact?: boolean }) {
  const query = useApi(periodPath('/api/pushups', period), pushupsSchema);
  const settings = useApi('/api/settings', settingsSchema);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const add = useAction(() => send('/api/pushups', pushupSchema, 'POST', { count }), ['/api/pushups', '/api/day-goal']);
  return (
    <section className={styles.card} aria-label="Pushups">
      <header>
        <h2>Pushups</h2>
        <DialogTrigger
          isOpen={open}
          onOpenChange={(value) => {
            setOpen(value);
            if (value) setCount(0);
          }}
        >
          <Button variant="outlined">Add pushups</Button>
          <Dialog title="Add pushups">
            <div className={styles.dialog}>
              <DonutSlider label="Pushups" value={count} onChange={setCount} min={0} valuePerTurn={10} />
              <div className={styles.actions}>
                <Button variant="text" onPress={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  isDisabled={count <= 0 || add.isPending}
                  onPress={() => add.mutate(undefined, { onSuccess: () => setOpen(false) })}
                >
                  Add {count}
                </Button>
              </div>
            </div>
          </Dialog>
        </DialogTrigger>
      </header>
      <QueryState query={query}>
        {(sets) => {
          const totals = sets.reduce<Record<string, number>>((result, set) => {
            const day = new Date(set.createdAt).toISOString().slice(0, 10);
            return { ...result, [day]: (result[day] ?? 0) + set.count };
          }, {});
          const today = new Date().toISOString().slice(0, 10);
          const end = new Date(`${today}T00:00:00Z`).getTime();
          const first = Object.keys(totals).sort()[0];
          const start = period ? end - (period - 1) * 86400000 : first ? new Date(first).getTime() : end;
          const data = Array.from({ length: Math.floor((end - start) / 86400000) + 1 }, (_, index) => {
            const time = start + index * 86400000;
            return [time, totals[new Date(time).toISOString().slice(0, 10)] ?? null];
          });
          return compact ? (
            <p className={styles.total}>
              {totals[today] ?? 0} <small>today</small>
            </p>
          ) : (
            <Chart
              option={{
                aria: { enabled: true },
                animation: false,
                grid: { top: 24, right: 10, bottom: 10, left: 10 },
                xAxis: { type: 'time', show: false, min: start - 43200000, max: end + 43200000 },
                yAxis: { type: 'value', show: false, min: 0 },
                series: [
                  {
                    name: 'Pushups',
                    type: 'bar',
                    data,
                    itemStyle: { color: '#3487ff' },
                    label: {
                      show: true,
                      position: 'top',
                      color: '#eee',
                      formatter: (params) => String((params.value as [number, number | null])[1] ?? ''),
                    },
                    markLine: {
                      silent: true,
                      symbol: 'none',
                      label: { show: false },
                      data: settings.data?.tiers.flatMap((tier) =>
                        tier.goals
                          .filter((goal) => goal.metric === 'PUSHUPS' && goal.required && goal.goal !== null)
                          .map((goal) => ({ yAxis: goal.goal!, lineStyle: { color: tiers[tier.tier].color } }))
                      ),
                    },
                  },
                ],
              }}
            />
          );
        }}
      </QueryState>
    </section>
  );
}
