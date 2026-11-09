import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import {
  applyEach,
  form,
  FormField,
  FormRoot,
  hidden,
  max,
  min,
  required,
  submit,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { ReadingLibraryComponent } from '../reading/reading-library.component';
import { DailyTasksLibraryComponent } from '../daily-tasks/daily-tasks-library.component';
import { CoinsService } from '../coins/coins.service';
import { METRICS, TierGoals, TIERS } from '../day-goal/day-goal.model';
import { Settings, SettingsService } from './settings.service';

const MIN_GOAL = 1;
const MAX_GOAL = 100000;

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [
    FormField,
    FormRoot,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    BarLoaderComponent,
    ReadingLibraryComponent,
    DailyTasksLibraryComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly coinsService = inject(CoinsService);

  readonly TIERS = TIERS;
  readonly METRICS = METRICS;

  readonly settings = resource({
    params: () => this.settingsService.version(),
    loader: () => this.settingsService.getSettings(),
  });

  readonly coins = resource({
    params: () => this.coinsService.version(),
    loader: () => this.coinsService.getCoins(),
  });

  readonly resetting = signal(false);
  readonly totalCoins = computed(() => this.coins.value()?.totalCoins ?? 0);
  readonly totalPoints = computed(() => this.coins.value()?.totalPoints ?? 0);
  readonly pointsPerCoin = computed(() => this.coins.value()?.pointsPerCoin ?? 5);

  readonly model = signal<Settings>({ tiers: [] });

  readonly settingsForm = form(this.model, (path) => {
    applyEach(path.tiers, (tier) => {
      applyEach(tier.goals, (goal) => {
        hidden(goal.goal, ({ valueOf }) => !valueOf(goal.required));
        required(goal.goal);
        min(goal.goal, MIN_GOAL);
        max(goal.goal, MAX_GOAL);
      });
    });
  });

  readonly saving = signal(false);
  readonly canSave = computed(
    () => !this.saving() && this.settingsForm().valid()
  );

  constructor() {
    effect(() => {
      const value = this.settings.value();
      if (!value) {
        return;
      }
      this.model.set(value);
    });
  }

  requiresNothing(tier: TierGoals): boolean {
    return !tier.goals.some((goal) => goal.required);
  }

  async save() {
    if (!this.canSave()) {
      return;
    }
    this.saving.set(true);
    try {
      await submit(this.settingsForm, async (form) => {
        await this.settingsService.updateSettings(form().value());
        return [];
      });
    } finally {
      this.saving.set(false);
    }
  }

  async resetCoins() {
    if (this.resetting()) {
      return;
    }
    this.resetting.set(true);
    try {
      await this.coinsService.resetCoins();
    } finally {
      this.resetting.set(false);
    }
  }
}
