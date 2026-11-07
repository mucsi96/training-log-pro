import { useEffect, useRef, useState } from 'react';
import { Button } from '@mucsi96/react-ui';
import styles from './Pomodoro.module.css';

const duration = 25 * 60;
export function Pomodoro() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(duration);
  const [flashing, setFlashing] = useState(false);
  const notification = useRef<Notification | null>(null);
  const countdown = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const completed = deadline !== null && remaining === 0;

  useEffect(() => {
    if (deadline === null) return;
    let notified = false;
    const refresh = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds > 0) return;
      setFlashing((value) => !value);
      if (notified) return;
      notified = true;
      if ('Notification' in window && window.isSecureContext && Notification.permission === 'granted') {
        try {
          notification.current = new Notification('Pomodoro complete', {
            body: 'Your 25-minute focus session is over. Time for a break!',
            tag: 'pomodoro-complete',
          });
          notification.current.onclick = () => {
            window.focus();
            setDeadline(null);
          };
        } catch (error) {
          console.warn('Pomodoro notification could not be shown', error);
        }
      }
    };
    const interval = setInterval(refresh, 1000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      notification.current?.close();
      notification.current = null;
    };
  }, [deadline]);

  useEffect(() => {
    if (deadline === null) return;
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')!;
    const original = { href: icon.href, type: icon.type, title: document.title };
    const progress = remaining / duration;
    const color = completed || progress <= 0.2 ? '#ef5350' : progress <= 0.5 ? '#ffa726' : '#66bb6a';
    const ring = completed ? (flashing ? 100 : 0) : progress * 100;
    document.title = `${completed && flashing ? "Time's up!" : countdown} · Tracker`;
    icon.type = 'image/svg+xml';
    icon.href = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="#37474f" stroke-width="7"/><circle cx="16" cy="16" r="12" fill="none" stroke="${color}" stroke-width="7" pathLength="100" stroke-dasharray="${ring} 100" transform="rotate(-90 16 16)"/></svg>`)}`;
    return () => {
      document.title = original.title;
      icon.href = original.href;
      icon.type = original.type;
    };
  }, [deadline, remaining, completed, flashing, countdown]);

  const start = () => {
    setRemaining(duration);
    setFlashing(false);
    setDeadline(Date.now() + duration * 1000);
    if ('Notification' in window && window.isSecureContext && Notification.permission === 'default')
      void Notification.requestPermission().catch((error) =>
        console.warn('Notification permission unavailable', error)
      );
  };
  return (
    <div className={styles.timer}>
      {deadline === null ? (
        <Button variant="text" onPress={start} aria-label="Start Pomodoro">
          ◷
        </Button>
      ) : completed ? (
        <>
          <span role="status">Focus session complete</span>
          <Button onPress={() => setDeadline(null)} aria-label="Dismiss Pomodoro">
            Dismiss
          </Button>
        </>
      ) : (
        <>
          <span role="timer" aria-label="Pomodoro time remaining">
            {countdown}
          </span>
          <Button variant="icon" aria-label="Cancel Pomodoro" onPress={() => setDeadline(null)}>
            ×
          </Button>
        </>
      )}
    </div>
  );
}
