import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SettingsService } from './settings.service';

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly settingsService = inject(SettingsService);

  readonly goal = resource({
    params: () => this.settingsService.version(),
    loader: () => this.settingsService.getGoldenDayGoal(),
  });

  readonly pushupGoal = signal<number | null>(null);
  readonly elevationGoal = signal<number | null>(null);
  readonly saving = signal(false);

  readonly canSave = computed(() => {
    const pushups = this.pushupGoal();
    const elevation = this.elevationGoal();
    return (
      !this.saving() &&
      pushups !== null &&
      Number.isInteger(pushups) &&
      pushups >= 1 &&
      elevation !== null &&
      Number.isInteger(elevation) &&
      elevation >= 1
    );
  });

  constructor() {
    effect(() => {
      const value = this.goal.value();
      if (!value) {
        return;
      }
      this.pushupGoal.set(value.pushupGoal);
      this.elevationGoal.set(value.elevationGoal);
    });
  }

  async save() {
    const pushups = this.pushupGoal();
    const elevation = this.elevationGoal();
    if (pushups === null || elevation === null || !this.canSave()) {
      return;
    }
    this.saving.set(true);
    try {
      await this.settingsService.updateGoldenDayGoal({
        pushupGoal: pushups,
        elevationGoal: elevation,
      });
    } finally {
      this.saving.set(false);
    }
  }
}
