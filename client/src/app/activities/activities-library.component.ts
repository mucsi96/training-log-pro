import { Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { LocationsService } from '../locations/locations.service';
import { Activity, ActivityRequest, ActivitiesService } from './activities.service';

function emptyDraft(): ActivityRequest {
  return {
    name: '',
    durationMinutes: 30,
    occurrencesPerWeek: 1,
    locationId: null,
    earliestTime: '',
    latestTime: '',
    daysOfWeek: '',
    constraintNote: '',
    priority: null,
  };
}

@Component({
  standalone: true,
  selector: 'app-activities-library',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    BarLoaderComponent,
  ],
  templateUrl: './activities-library.component.html',
  styleUrl: '../shared/entity-library.component.css',
})
export class ActivitiesLibraryComponent {
  private readonly activitiesService = inject(ActivitiesService);
  private readonly locationsService = inject(LocationsService);

  readonly busy = signal(false);
  readonly adding = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly draft = signal<ActivityRequest>(emptyDraft());

  readonly activities = resource({
    params: () => this.activitiesService.version(),
    loader: () => this.activitiesService.listActivities(),
  });

  readonly locations = resource({
    params: () => this.locationsService.version(),
    loader: () => this.locationsService.listLocations(),
  });

  readonly showForm = computed(() => this.adding() || this.editingId() !== null);
  readonly canSubmit = computed(
    () => !this.busy() && this.draft().name.trim().length > 0
  );

  locationName(id?: string | null): string {
    return this.locations.value()?.find((location) => location.id === id)?.name ?? '';
  }

  patch(change: Partial<ActivityRequest>) {
    this.draft.update((draft) => ({ ...draft, ...change }));
  }

  startAdding() {
    this.editingId.set(null);
    this.draft.set(emptyDraft());
    this.adding.set(true);
  }

  startEditing(activity: Activity) {
    this.adding.set(false);
    const { id, ...request } = activity;
    this.draft.set({ ...request });
    this.editingId.set(activity.id);
  }

  cancel() {
    this.adding.set(false);
    this.editingId.set(null);
    this.draft.set(emptyDraft());
  }

  async submit() {
    if (!this.canSubmit()) return;
    const editingId = this.editingId();
    this.busy.set(true);
    try {
      if (editingId !== null) {
        await this.activitiesService.updateActivity(editingId, this.draft());
      } else {
        await this.activitiesService.addActivity(this.draft());
      }
      this.cancel();
    } finally {
      this.busy.set(false);
    }
  }

  async remove(activity: Activity) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.activitiesService.deleteActivity(activity.id);
    } finally {
      this.busy.set(false);
    }
  }
}
