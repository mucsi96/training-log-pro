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
const TAU = Math.PI * 2;

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
    '[attr.aria-valuemin]': 'min()',
    '[attr.aria-valuemax]': 'max()',
    '[attr.aria-valuetext]': 'ariaValueText()',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '[attr.aria-disabled]': 'disabled()',
    '[class.dragging]': 'dragging()',
    '(keydown)': 'onKey($event)',
    '(wheel)': 'onWheel($event)',
  },
})
export class CircularSliderComponent {
  readonly ariaLabel = input('Value');
  readonly unitsPerRevolution = input(10);
  readonly disabled = input(false);
  readonly trackWidth = input(28);
  readonly handleRadius = input(16);
  readonly min = input(0);
  readonly max = input<number | null>(null);
  readonly unitLabel = input('pushups');

  readonly value = model.required<number>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  protected readonly dragging = signal(false);
  private readonly accumulator = signal(0);
  private prevAngle: number | null = null;

  readonly size = SVG_SIZE;
  readonly center = CENTER;
  readonly trackRadius = computed(
    () => CENTER - Math.max(this.trackWidth() / 2, this.handleRadius())
  );
  private readonly circumference = computed(() => TAU * this.trackRadius());

  private readonly displayAngle = computed(() => {
    const v = this.value();
    const total = (v * 360) / this.unitsPerRevolution();
    if (total === 0) {
      return 0;
    }
    const mod = total % 360;
    return mod === 0 ? 360 : mod;
  });

  readonly rangeDashArray = computed(() => {
    const c = this.circumference();
    const visible = (this.displayAngle() / 360) * c;
    return `${visible} ${c - visible}`;
  });

  readonly handlePoint = computed(() => this.angleToPoint(this.displayAngle()));
  readonly ariaValueText = computed(() => `${this.value()} ${this.unitLabel()}`);

  constructor() {
    effect(() => {
      const v = this.value();
      if (!this.dragging() && Math.round(this.accumulator()) !== v) {
        this.accumulator.set(v);
      }
    });
  }

  onPointerDown(event: PointerEvent): void {
    if (this.disabled() || event.button !== 0) {
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
    const next = this.clamp(
      this.accumulator() + (delta / 360) * this.unitsPerRevolution()
    );
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
        next = this.min();
        break;
      default:
        return;
    }
    event.preventDefault();
    this.commit(next);
  }

  onWheel(event: WheelEvent): void {
    if (this.disabled() || document.activeElement !== this.host.nativeElement) {
      return;
    }
    event.preventDefault();
    this.commit(this.value() + (event.deltaY < 0 ? 1 : -1));
  }

  private commit(next: number): void {
    const clamped = this.clamp(next);
    if (clamped !== this.value()) {
      this.value.set(clamped);
    }
  }

  private clamp(value: number): number {
    const max = this.max();
    const upperBound = max ?? Infinity;
    return Math.min(upperBound, Math.max(this.min(), value));
  }

  private angleToPoint(angleDeg: number): Point {
    const r = this.trackRadius();
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: CENTER + r * Math.sin(rad),
      y: CENTER - r * Math.cos(rad),
    };
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
