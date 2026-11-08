import { lazy, Suspense } from 'react';
import { AppMain, LoadingArea } from '@mucsi96/react-ui';
import { Link, Route, Routes } from 'react-router-dom';
import { useApi } from './api';
import { environmentSchema } from './schemas';
import { QueryState } from './QueryState';
import { Header } from './Header';
import styles from './App.module.css';

const Dashboard = lazy(() => import('./Dashboard'));
const Settings = lazy(() => import('./Settings'));
const Devices = lazy(() => import('./Devices'));

export function App() {
  const environment = useApi('/api/environment', environmentSchema);
  return (
    <div className={styles.layout}>
      <Header />
      <AppMain className={styles.main}>
        <QueryState query={environment} label="Loading application settings" fill>
          {() => (
            <Suspense fallback={<LoadingArea label="Opening page" fill />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/year" element={<Dashboard />} />
                <Route path="/all-time" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/devices" element={<Devices />} />
                <Route
                  path="*"
                  element={
                    <p>
                      Page not found. <Link to="/">Return to dashboard</Link>
                    </p>
                  }
                />
              </Routes>
            </Suspense>
          )}
        </QueryState>
      </AppMain>
    </div>
  );
}
