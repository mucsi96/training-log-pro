import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'relativeDate', standalone: true })
export class RelativeDatePipe implements PipeTransform {
  private readonly formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  transform(value: string): string {
    const date = new Date(value);
    const today = new Date();
    // Compare local calendar dates without daylight-saving time affecting day lengths.
    const days = Math.round(
      (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86_400_000
    );
    const months = (today.getFullYear() - date.getFullYear()) * 12 +
      today.getMonth() - date.getMonth() - (today.getDate() < date.getDate() ? 1 : 0);

    if (months >= 12) return this.formatter.format(-Math.floor(months / 12), 'year');
    if (months >= 1) return this.formatter.format(-months, 'month');
    return this.formatter.format(-days, 'day');
  }
}
