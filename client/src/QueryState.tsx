import { Alert, Button } from '@mucsi96/react-ui';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import styles from './QueryState.module.css';

export function LoadingSkeleton() {
  return <div className={styles.skeleton} role="status" aria-label="Loading" />;
}

export function QueryState<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError)
    return (
      <Alert tone="error" title="Unable to load data">
        <p>{query.error.message}</p>
        <Button onPress={() => void query.refetch()}>Retry</Button>
      </Alert>
    );
  return children(query.data);
}
