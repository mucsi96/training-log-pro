import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'diffColor',
  standalone: true,
})
export class DiffColorPipe implements PipeTransform {
  transform(
    value: number = 0,
    inverse?: 'inverse',
    threshold: number = 0.001,
  ): 'green' | 'red' | undefined {
    if (value > threshold) {
      return inverse ? 'red' : 'green';
    } else if (value < -threshold) {
      return inverse ? 'green' : 'red';
    }

    return;
  }
}
