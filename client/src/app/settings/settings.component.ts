import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { form, FormField, max, min, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GoldenDayGoal, SettingsService } from './settings.service';

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [
    FormField,
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

  readonly model = signal<GoldenDayGoal>({ pushupGoal: 100, elevationGoal: 250 });

  readonly goalForm = form(this.model, (path) => {
    required(path.pushupGoal);
    min(path.pushupGoal, 1);
    max(path.pushupGoal, 10000);
    required(path.elevationGoal);
    min(path.elevationGoal, 1);
    max(path.elevationGoal, 100000);
  });

  readonly saving = signal(false);
  readonly canSave = computed(
    () => !this.saving() && this.goalForm().valid()
  );

  constructor() {
    effect(() => {
      const value = this.goal.value();
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
      await submit(this.goalForm, async (form) => {
        await this.settingsService.updateGoldenDayGoal(form().value());
        return [];
      });
    } finally {
      this.saving.set(false);
    }
  }
}
