import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'pointsDiff',
  standalone: true,
})
export class PointsDiffPipe implements PipeTransform {
  transform(value: number | undefined = 0): string {
    const rounded = parseInt((10 * (value ?? 0)).toFixed(0));

    if (rounded > 0) {
      return `↑ ${rounded / 10}`;
    } else if (rounded < 0) {
      return `↓ ${-rounded / 10}`;
    }

    return '-';
  }
}
