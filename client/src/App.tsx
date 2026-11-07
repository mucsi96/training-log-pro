import { lazy, Suspense } from 'react';
import { AppMain } from '@mucsi96/react-ui';
import { Link, Route, Routes } from 'react-router-dom';
import { useApi } from './api';
import { environmentSchema } from './schemas';
import { LoadingSkeleton, QueryState } from './QueryState';
import { Header } from './Header';

const Dashboard = lazy(() => import('./Dashboard'));
const Settings = lazy(() => import('./Settings'));
const Devices = lazy(() => import('./Devices'));

export function App() {
  const environment = useApi('/api/environment', environmentSchema);
  return (
    <QueryState query={environment}>
      {() => (
        <>
          <Header />
          <AppMain>
            <Suspense fallback={<LoadingSkeleton />}>
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
          </AppMain>
        </>
      )}
    </QueryState>
  );
}
