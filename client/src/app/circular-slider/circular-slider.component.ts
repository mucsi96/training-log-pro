import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

const SVG_SIZE = 280;
const CENTER = SVG_SIZE / 2;

type Point = { x: number; y: number };

@Component({
  standalone: true,
  selector: 'app-circular-slider',
  templateUrl: './circular-slider.component.html',
  styleUrl: './circular-slider.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'spinbutton',
    '[attr.aria-valuenow]': 'value()',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuetext]': 'ariaValueText()',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '[attr.aria-disabled]': 'disabled()',
    '(keydown)': 'onKey($event)',
  },
})
export class CircularSliderComponent {
  readonly ariaLabel = input('Value');
  readonly unitsPerRevolution = input(10);
  readonly disabled = input(false);
  readonly trackWidth = input(28);
  readonly handleRadius = input(16);

  readonly value = model.required<number>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly dragging = signal(false);
  private readonly accumulator = signal(0);
  private prevAngle: number | null = null;

  readonly size = SVG_SIZE;
  readonly center = CENTER;
  readonly trackRadius = computed(
    () => CENTER - Math.max(this.trackWidth() / 2, this.handleRadius())
  );

  private readonly displayAngle = computed(() => {
    const v = this.value();
    const units = this.unitsPerRevolution();
    if (v > 0 && v % units === 0) {
      return 359.999;
    }
    const degreesPerUnit = 360 / units;
    const total = (v * degreesPerUnit) % 360;
    return total < 0 ? total + 360 : total;
  });

  readonly arcPath = computed(() => this.buildArc(this.displayAngle()));
  readonly handlePoint = computed(() => this.angleToPoint(this.displayAngle()));
  readonly ariaValueText = computed(() => `${this.value()} pushups`);

  constructor() {
    effect(() => {
      const v = this.value();
      if (!this.dragging() && Math.round(this.accumulator()) !== v) {
        this.accumulator.set(v);
      }
    });
  }

  onPointerDown(event: PointerEvent): void {
    if (this.disabled()) {
      return;
    }
    event.preventDefault();
    const target = event.target as Element;
    target.setPointerCapture(event.pointerId);
    this.accumulator.set(this.value());
    this.prevAngle = this.pointToAngle(event);
    this.dragging.set(true);
    this.host.nativeElement.focus();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging() || this.disabled() || this.prevAngle === null) {
      return;
    }
    const angle = this.pointToAngle(event);
    let delta = angle - this.prevAngle;
    if (delta > 180) {
      delta -= 360;
    } else if (delta < -180) {
      delta += 360;
    }
    this.prevAngle = angle;
    const degreesPerUnit = 360 / this.unitsPerRevolution();
    const next = Math.max(0, this.accumulator() + delta / degreesPerUnit);
    this.accumulator.set(next);
    const rounded = Math.round(next);
    if (rounded !== this.value()) {
      this.value.set(rounded);
    }
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.dragging()) {
      return;
    }
    this.dragging.set(false);
    this.prevAngle = null;
    (event.target as Element).releasePointerCapture(event.pointerId);
  }

  onKey(event: KeyboardEvent): void {
    if (this.disabled()) {
      return;
    }
    const v = this.value();
    let next: number;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        next = v + 1;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        next = v - 1;
        break;
      case 'PageUp':
        next = v + this.unitsPerRevolution();
        break;
      case 'PageDown':
        next = v - this.unitsPerRevolution();
        break;
      case 'Home':
        next = 0;
        break;
      default:
        return;
    }
    event.preventDefault();
    const clamped = Math.max(0, next);
    if (clamped !== v) {
      this.value.set(clamped);
    }
  }

  private angleToPoint(angleDeg: number): Point {
    const r = this.trackRadius();
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: CENTER + r * Math.sin(rad),
      y: CENTER - r * Math.cos(rad),
    };
  }

  private buildArc(angle: number): string {
    if (angle <= 0) {
      return '';
    }
    const r = this.trackRadius();
    const clamped = Math.min(359.999, angle);
    const end = this.angleToPoint(clamped);
    const largeArc = clamped > 180 ? 1 : 0;
    return `M ${CENTER} ${CENTER - r} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  }

  private pointToAngle(event: PointerEvent): number {
    const rect = this.svgRef().nativeElement.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (deg < 0) {
      deg += 360;
    }
    return deg;
  }
}
