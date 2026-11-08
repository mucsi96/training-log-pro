import { useState } from 'react';
import { Button, Checkbox, TextField } from '@mucsi96/react-ui';
import { send, useAction, useApi } from './api';
import { settingsSchema, coinsSchema, type Settings as SettingsData } from './schemas';
import { tiers, metrics } from './format';
import { QueryState } from './QueryState';
import { TaskLibrary } from './Tasks';
import { BookLibrary } from './BookLibrary';
import styles from './Settings.module.css';

function GoalSettings({ initial }: { initial: SettingsData }) {
  const [draft, setDraft] = useState(initial);
  const save = useAction(
    () => send('/api/settings', settingsSchema, 'PUT', draft),
    ['/api/settings', '/api/day-goal'],
    'Settings saved',
    'Unable to save settings'
  );
  const valid = draft.tiers.every((tier) =>
    tier.goals.every(
      (goal) =>
        !goal.required || (goal.goal !== null && Number.isInteger(goal.goal) && goal.goal >= 1 && goal.goal <= 100000)
    )
  );
  const change = (
    tierIndex: number,
    goalIndex: number,
    changes: Partial<SettingsData['tiers'][number]['goals'][number]>
  ) =>
    setDraft({
      tiers: draft.tiers.map((tier, i) =>
        i !== tierIndex
          ? tier
          : { ...tier, goals: tier.goals.map((goal, j) => (j !== goalIndex ? goal : { ...goal, ...changes })) }
      ),
    });
  return (
    <form
      aria-label="Day goal tiers"
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) save.mutate(undefined, { onSuccess: setDraft });
      }}
    >
      <h2>Day goal tiers</h2>
      <div className={styles.tiers}>
        {draft.tiers.map((tier, i) => (
          <fieldset key={tier.tier}>
            <legend style={{ color: tiers[tier.tier].color }}>{tiers[tier.tier].label}</legend>
            {tier.goals.map((goal, j) => (
              <div key={goal.metric} className={styles.requirement}>
                <Checkbox isSelected={goal.required} onChange={(required) => change(i, j, { required })}>
                  {metrics[goal.metric].label}
                </Checkbox>
                {goal.required && (
                  <TextField
                    label={`${metrics[goal.metric].label} goal`}
                    type="number"
                    value={goal.goal?.toString() ?? ''}
                    onChange={(value) => change(i, j, { goal: value === '' ? null : Number(value) })}
                  />
                )}
              </div>
            ))}
            {!tier.goals.some((goal) => goal.required) && (
              <p>Nothing is required, so a {tiers[tier.tier].label.toLowerCase()} day is never awarded.</p>
            )}
          </fieldset>
        ))}
      </div>
      <Button type="submit" isDisabled={!valid || save.isPending}>
        Save
      </Button>
    </form>
  );
}

export default function Settings() {
  const settings = useApi('/api/settings', settingsSchema);
  const coins = useApi('/api/coins', coinsSchema);
  const reset = useAction(
    () => send('/api/coins/reset', coinsSchema, 'POST'),
    ['/api/coins'],
    'Coins reset',
    'Unable to reset coins'
  );
  return (
    <div className={styles.page}>
      <header>
        <h1>Settings</h1>
        <p>
          Configure what a gold, silver or bronze day takes. A day earns the most demanding tier whose requirements it
          meets. Changes apply from today onwards and never take away a tier a day has already earned.
        </p>
      </header>
      <QueryState query={settings} label="Loading goals">{(data) => <GoalSettings initial={data} />}</QueryState>
      <section aria-label="Golden coins" className={styles.coins}>
        <h2>Golden coins</h2>
        <QueryState query={coins} label="Loading coins">
          {(data) => (
            <>
              <p>{data.totalPoints} points</p>
              <p>
                <span>
                  {data.totalCoins} {data.totalCoins === 1 ? 'coin' : 'coins'}
                </span>{' '}
                · {data.pointsPerCoin} per gold day
              </p>
              <Button variant="outlined" isDisabled={reset.isPending} onPress={() => reset.mutate()}>
                Reset coin count
              </Button>
            </>
          )}
        </QueryState>
      </section>
      <TaskLibrary />
      <BookLibrary />
    </div>
  );
}
