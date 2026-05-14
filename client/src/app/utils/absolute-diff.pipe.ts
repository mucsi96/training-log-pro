import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'absoluteDiff',
  standalone: true,
})
export class AbsoluteDiffPipe implements PipeTransform {
  transform(value: number = 0, unit: string = '', decimals: number = 1): string {
    const multiplier = Math.pow(10, decimals);
    const clampedValue = parseInt((multiplier * value).toFixed(0));

    if (clampedValue > 0) {
      return [`↑ ${clampedValue / multiplier}`, unit].filter(Boolean).join(' ');
    } else if (clampedValue < 0) {
      return [`↓ ${-clampedValue / multiplier}`, unit].filter(Boolean).join(' ');
    }

    return '-';
  }
}
