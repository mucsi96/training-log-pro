import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'absoluteDiff',
  standalone: true,
})
export class AbsoluteDiffPipe implements PipeTransform {
  transform(value: number = 0, unit: string = '', decimals: number = 1): string {
    const multiplier = Math.pow(10, decimals);
    const rounded = Math.round(multiplier * value);

    if (rounded > 0) {
      return [`↑ ${(rounded / multiplier).toFixed(decimals)}`, unit]
        .filter(Boolean)
        .join(' ');
    } else if (rounded < 0) {
      return [`↓ ${(-rounded / multiplier).toFixed(decimals)}`, unit]
        .filter(Boolean)
        .join(' ');
    }

    return '-';
  }
}
