import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { form, FormField, FormRoot, max, min, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { ReadingLibraryComponent } from '../reading/reading-library.component';
import { DailyTasksLibraryComponent } from '../daily-tasks/daily-tasks-library.component';
import { LocationsLibraryComponent } from '../locations/locations-library.component';
import { ActivitiesLibraryComponent } from '../activities/activities-library.component';
import { CoinsService } from '../coins/coins.service';
import { Settings, SettingsService } from './settings.service';

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [
    FormField,
    FormRoot,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    BarLoaderComponent,
    ReadingLibraryComponent,
    DailyTasksLibraryComponent,
    LocationsLibraryComponent,
    ActivitiesLibraryComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly coinsService = inject(CoinsService);

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

  readonly model = signal<Settings>({
    pushupGoal: 100,
    elevationGoal: 250,
    readingPagesGoal: 0,
    dailyTaskGoal: 0,
    workStartTime: '09:00',
    workEndTime: '17:00',
    rainThresholdMm: 1,
  });

  readonly settingsForm = form(this.model, (path) => {
    required(path.pushupGoal);
    min(path.pushupGoal, 1);
    max(path.pushupGoal, 10000);
    required(path.elevationGoal);
    min(path.elevationGoal, 1);
    max(path.elevationGoal, 100000);
    required(path.readingPagesGoal);
    min(path.readingPagesGoal, 0);
    max(path.readingPagesGoal, 10000);
    required(path.dailyTaskGoal);
    min(path.dailyTaskGoal, 0);
    max(path.dailyTaskGoal, 100);
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
      this.model.set({ ...value });
    });
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
