import { Component, computed, inject, resource } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CoinsService } from './coins.service';

@Component({
  standalone: true,
  selector: 'app-coins-counter',
  imports: [MatTooltipModule],
  templateUrl: './coins-counter.component.html',
  styleUrl: './coins-counter.component.css',
})
export class CoinsCounterComponent {
  private readonly service = inject(CoinsService);

  readonly coins = resource({
    params: () => this.service.version(),
    loader: () => this.service.getCoins(),
  });

  readonly totalCoins = computed(() => this.coins.value()?.totalCoins ?? 0);
  readonly totalPoints = computed(() => this.coins.value()?.totalPoints ?? 0);
  readonly pointsPerCoin = computed(() => this.coins.value()?.pointsPerCoin ?? 5);
  readonly label = computed(
    () =>
      `Golden coins: ${this.totalCoins()} ${this.totalCoins() === 1 ? 'coin' : 'coins'}, ${this.totalPoints()} points`
  );
  readonly tooltip = computed(
    () =>
      `${this.totalCoins()} golden ${this.totalCoins() === 1 ? 'coin' : 'coins'} · ${this.pointsPerCoin()} points each`
  );
}
