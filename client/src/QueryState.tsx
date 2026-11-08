import { Alert, Button, LoadingArea } from '@mucsi96/react-ui';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export function QueryState<T>({ query, children, label, fill = false }: { query: UseQueryResult<T>; children: (data: T) => ReactNode; label: string; fill?: boolean }) {
  if (query.isPending) return <LoadingArea label={label} fill={fill} />;
  if (query.isError)
    return (
      <Alert tone="error" title="Unable to load data">
        <p>{query.error.message}</p>
        <Button onPress={() => void query.refetch()}>Retry</Button>
      </Alert>
    );
  return children(query.data);
}
