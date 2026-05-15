import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
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
    role: 'slider',
    '[attr.aria-valuemin]': 'min()',
    '[attr.aria-valuemax]': 'max()',
    '[attr.aria-valuenow]': 'value()',
    '[attr.aria-valuetext]': 'value() + " of " + max()',
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '[attr.aria-disabled]': 'disabled()',
    '(keydown)': 'onKey($event)',
  },
})
export class CircularSliderComponent {
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);
  readonly disabled = input(false);
  readonly ariaLabel = input('Value');
  readonly trackWidth = input(28);
  readonly handleRadius = input(16);

  readonly value = model.required<number>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly dragging = signal(false);

  readonly size = SVG_SIZE;
  readonly center = CENTER;
  readonly trackRadius = computed(
    () => CENTER - Math.max(this.trackWidth() / 2, this.handleRadius())
  );

  private readonly angle = computed(() => this.valueToAngle(this.value()));
  readonly arcPath = computed(() => this.buildArc(this.angle()));
  readonly handlePoint = computed(() => this.angleToPoint(this.angle()));

  onPointerDown(event: PointerEvent): void {
    if (this.disabled()) {
      return;
    }
    event.preventDefault();
    const target = event.target as Element;
    target.setPointerCapture(event.pointerId);
    this.dragging.set(true);
    this.commit(this.angleToValue(this.pointToAngle(event)));
    this.host.nativeElement.focus();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging() || this.disabled()) {
      return;
    }
    this.commit(this.angleToValue(this.pointToAngle(event)));
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.dragging()) {
      return;
    }
    this.dragging.set(false);
    (event.target as Element).releasePointerCapture(event.pointerId);
  }

  onKey(event: KeyboardEvent): void {
    if (this.disabled()) {
      return;
    }
    const v = this.value();
    const s = this.step();
    let next: number;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        next = v + s;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        next = v - s;
        break;
      case 'PageUp':
        next = v + s * 10;
        break;
      case 'PageDown':
        next = v - s * 10;
        break;
      case 'Home':
        next = this.min();
        break;
      case 'End':
        next = this.max();
        break;
      default:
        return;
    }
    event.preventDefault();
    this.commit(this.snap(next));
  }

  private valueToAngle(value: number): number {
    const range = this.max() - this.min();
    if (range <= 0) {
      return 0;
    }
    const fraction = (value - this.min()) / range;
    return Math.max(0, Math.min(1, fraction)) * 360;
  }

  private angleToValue(angle: number): number {
    const range = this.max() - this.min();
    return this.snap(this.min() + (angle / 360) * range);
  }

  private snap(value: number): number {
    const step = this.step();
    const min = this.min();
    const snapped = Math.round((value - min) / step) * step + min;
    return Math.max(min, Math.min(this.max(), snapped));
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

  private commit(next: number): void {
    if (next !== this.value()) {
      this.value.set(next);
    }
  }
}
