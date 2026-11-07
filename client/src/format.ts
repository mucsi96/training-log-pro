export const number = (value: number, digits = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value).replaceAll(',', ' ');
export function measurement(value: number | null | undefined, unit = '', digits = 0, divisor = 1): string {
  if (value == null) return '-';
  const result = Number((value / divisor).toFixed(digits));
  if (result === 0) return '-';
  if (unit === 'min') {
    const minutes = Math.round(result);
    return [minutes >= 60 ? `${number(Math.floor(minutes / 60))} h` : '', minutes % 60 ? `${minutes % 60} min` : '']
      .filter(Boolean)
      .join(' ');
  }
  return `${number(result, digits)}${unit ? ` ${unit}` : ''}`;
}
export const difference = (value: number | undefined, unit = '', digits = 1) =>
  value === undefined || Number(value.toFixed(digits)) === 0
    ? '-'
    : `${value < 0 ? '↓' : '↑'} ${measurement(Math.abs(value), unit, digits)}`;
export const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
export const position = (value: number) =>
  `${value}${value === 1 ? 'st' : value === 2 ? 'nd' : value === 3 ? 'rd' : 'th'}`;
export const relativeDate = (date: string) => {
  const value = new Date(date);
  const today = new Date();
  const days = Math.round(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())) /
      86400000
  );
  const months =
    (today.getFullYear() - value.getFullYear()) * 12 +
    today.getMonth() -
    value.getMonth() -
    (today.getDate() < value.getDate() ? 1 : 0);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return months >= 12
    ? formatter.format(-Math.floor(months / 12), 'year')
    : months >= 1
      ? formatter.format(-months, 'month')
      : formatter.format(-days, 'day');
};
export const tiers = {
  GOLD: { label: 'Gold', color: '#facb2e' },
  SILVER: { label: 'Silver', color: '#b9bfc5' },
  BRONZE: { label: 'Bronze', color: '#d18c37' },
};
export const metrics = {
  PUSHUPS: { label: 'Pushups', unit: 'pushups' },
  ELEVATION: { label: 'Ride elevation', unit: 'm' },
  READING_MINUTES: { label: 'Reading', unit: 'min' },
  DAILY_TASKS: { label: 'Daily tasks', unit: 'tasks' },
};
