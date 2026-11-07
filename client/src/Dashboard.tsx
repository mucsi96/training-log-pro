import { Select } from '@mucsi96/react-ui';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { DailyTasks } from './Tasks';
import { DayGoal } from './DayGoal';
import { Pushups } from './Pushups';
import { Reading } from './Reading';
import { Training, Health } from './Measurements';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const view = ['training', 'health'].includes(search.get('view') ?? '') ? search.get('view')! : 'today';
  const period = pathname === '/year' ? 365 : pathname === '/all-time' ? 0 : 30;
  return (
    <>
      <div className={styles.range}>
        <Select
          label="Range"
          selectedKey={pathname}
          onSelectionChange={(key) => navigate(`${key}${view === 'today' ? '' : `?view=${view}`}`)}
          options={[
            { id: '/', label: 'Month' },
            { id: '/year', label: 'Year' },
            { id: '/all-time', label: 'All time' },
          ]}
        />
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Dashboard views">
        {['today', 'training', 'health'].map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={view === tab}
            aria-controls={`panel-${tab}`}
            id={`tab-${tab}`}
            tabIndex={view === tab ? 0 : -1}
            onClick={() => setSearch(tab === 'today' ? {} : { view: tab })}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const tabs = ['today', 'training', 'health'];
              const index =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? 2
                    : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
              setSearch(index === 0 ? {} : { view: tabs[index] });
              document.getElementById(`tab-${tabs[index]}`)?.focus();
            }}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`} className={styles.content}>
        {view === 'today' ? (
          <div className={styles.today}>
            <DayGoal />
            <DailyTasks />
            <Pushups period={period} compact />
            <Reading />
          </div>
        ) : view === 'training' ? (
          <>
            <header>
              <h2>Your rides</h2>
              <p>Today’s totals · selected period below</p>
            </header>
            <Training period={period} />
            <Pushups period={period} />
          </>
        ) : (
          <>
            <header>
              <h2>Body measurements</h2>
              <p>Your latest measurements and trends</p>
            </header>
            <Health period={period} />
          </>
        )}
      </div>
    </>
  );
}
