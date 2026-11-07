import { useState } from 'react';
import { Button, Checkbox, TextField } from '@mucsi96/react-ui';
import { send, useAction, useApi } from './api';
import { emptySchema, taskSchema, tasksSchema, todayTasksSchema } from './schemas';
import { QueryState } from './QueryState';
import styles from './Tasks.module.css';

export function DailyTasks() {
  const query = useApi('/api/tasks/today', todayTasksSchema);
  const [expanded, setExpanded] = useState(false);
  const action = useAction(
    ({ id, completed }: { id: string; completed: boolean }) =>
      send(`/api/tasks/${id}/completion`, emptySchema, 'PUT', { completed }),
    ['/api/tasks', '/api/day-goal']
  );
  return (
    <section className={styles.card} aria-label="Daily tasks">
      <h2>Daily tasks</h2>
      <QueryState query={query}>
        {(tasks) => (
          <>
            <span className={styles.count}>
              {tasks.filter((task) => task.completed).length} / {tasks.length} done
            </span>
            {!tasks.length && <p>No tasks yet. Add some in Settings.</p>}
            <div className={styles.list}>
              {(expanded ? tasks : tasks.slice(0, 2)).map((task) => (
                <Checkbox
                  key={task.id}
                  isSelected={task.completed}
                  isDisabled={action.isPending}
                  onChange={(completed) => action.mutate({ id: task.id, completed })}
                >
                  {task.name}
                </Checkbox>
              ))}
            </div>
            {tasks.length > 2 && (
              <Button variant="text" onPress={() => setExpanded(!expanded)} aria-expanded={expanded}>
                {expanded ? 'Show fewer tasks' : `View all ${tasks.length} tasks`}
              </Button>
            )}
          </>
        )}
      </QueryState>
    </section>
  );
}

export function TaskLibrary() {
  const query = useApi('/api/tasks', tasksSchema);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const save = useAction(
    () =>
      send(editing === 'new' ? '/api/tasks' : `/api/tasks/${editing}`, taskSchema, editing === 'new' ? 'POST' : 'PUT', {
        name: name.trim(),
      }),
    ['/api/tasks']
  );
  const remove = useAction(
    (id: string) => send(`/api/tasks/${id}`, emptySchema, 'DELETE'),
    ['/api/tasks', '/api/day-goal']
  );
  const form = (
    <form
      aria-label={editing === 'new' ? 'Add a task' : 'Edit task'}
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) save.mutate(undefined, { onSuccess: () => setEditing(null) });
      }}
    >
      <h3>{editing === 'new' ? 'Add a task' : 'Edit task'}</h3>
      <TextField label="Task name" value={name} onChange={setName} isRequired />
      <div className={styles.actions}>
        <Button variant="text" onPress={() => setEditing(null)}>
          Cancel
        </Button>
        <Button type="submit" isDisabled={!name.trim() || save.isPending}>
          {editing === 'new' ? 'Add task' : 'Save task'}
        </Button>
      </div>
    </form>
  );
  return (
    <section className={styles.card} aria-label="Daily tasks">
      <h2>Daily tasks</h2>
      <QueryState query={query}>
        {(tasks) => (
          <>
            {!tasks.length && !editing && <p>No tasks yet. Add things you want to do every day.</p>}
            <ul className={styles.list}>
              {tasks.map((task) => (
                <li key={task.id} aria-label={task.name}>
                  {editing === task.id ? (
                    form
                  ) : (
                    <>
                      <span>{task.name}</span>
                      <div className={styles.actions}>
                        <Button
                          variant="icon"
                          aria-label={`Edit ${task.name}`}
                          onPress={() => {
                            setName(task.name);
                            setEditing(task.id);
                          }}
                        >
                          ✎
                        </Button>
                        <Button
                          variant="icon"
                          aria-label={`Remove ${task.name}`}
                          isDisabled={remove.isPending}
                          onPress={() => remove.mutate(task.id)}
                        >
                          ×
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {editing === 'new' ? (
              form
            ) : (
              <Button
                variant="outlined"
                onPress={() => {
                  setName('');
                  setEditing('new');
                }}
              >
                Add task
              </Button>
            )}
          </>
        )}
      </QueryState>
    </section>
  );
}
