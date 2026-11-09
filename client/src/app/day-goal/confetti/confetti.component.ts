import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  viewChild,
} from '@angular/core';

interface Particle {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly rotation: number;
  readonly rotationSpeed: number;
  readonly color: string;
  readonly size: number;
  readonly opacity: number;
}

const COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#FF6EC7', '#845EC2', '#FFC75F', '#00C9A7',
];

const PARTICLE_COUNT = 150;
const GRAVITY = 0.12;
const FADE_RATE = 0.001;
const INITIAL_VELOCITY_X = 8;
const INITIAL_VELOCITY_Y_MIN = -14;
const INITIAL_VELOCITY_Y_MAX = -4;

function createParticle(canvasWidth: number): Particle {
  return {
    x: Math.random() * canvasWidth,
    y: -10,
    vx: (Math.random() - 0.5) * INITIAL_VELOCITY_X,
    vy: Math.random() * (INITIAL_VELOCITY_Y_MAX - INITIAL_VELOCITY_Y_MIN) + INITIAL_VELOCITY_Y_MIN,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: Math.random() * 24 + 12,
    opacity: 1,
  };
}

function updateParticle(p: Particle): Particle {
  return {
    ...p,
    x: p.x + p.vx,
    y: p.y + p.vy,
    vy: p.vy + GRAVITY,
    rotation: p.rotation + p.rotationSpeed,
    opacity: p.opacity - FADE_RATE,
  };
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.globalAlpha = Math.max(0, p.opacity);
  ctx.fillStyle = p.color;
  ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  ctx.restore();
}

@Component({
  selector: 'app-confetti',
  standalone: true,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styleUrl: './confetti.component.css',
})
export class ConfettiComponent implements OnInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private animationFrameId = 0;
  private particles: readonly Particle[] = [];

  ngOnInit(): void {
    const canvas = this.canvasRef().nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    this.particles = Array.from(
      { length: PARTICLE_COUNT },
      () => createParticle(canvas.width)
    );

    this.animate();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);
  }

  private animate(): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.particles = this.particles
      .map(updateParticle)
      .filter((p) => p.opacity > 0 && p.y < canvas.height + 50);

    this.particles.forEach((p) => drawParticle(ctx, p));

    if (this.particles.length > 0) {
      this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
  }
}
