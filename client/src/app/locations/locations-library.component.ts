import { Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { Location, LocationRequest, LocationsService } from './locations.service';

function emptyDraft(): LocationRequest {
  return {
    name: '',
    address: '',
    latitude: null,
    longitude: null,
    home: false,
    bikeMinutesFromHome: null,
    carMinutesFromHome: null,
  };
}

@Component({
  standalone: true,
  selector: 'app-locations-library',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    BarLoaderComponent,
  ],
  templateUrl: './locations-library.component.html',
  styleUrl: '../shared/entity-library.component.css',
})
export class LocationsLibraryComponent {
  private readonly locationsService = inject(LocationsService);

  readonly busy = signal(false);
  readonly adding = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly draft = signal<LocationRequest>(emptyDraft());

  readonly locations = resource({
    params: () => this.locationsService.version(),
    loader: () => this.locationsService.listLocations(),
  });

  readonly showForm = computed(() => this.adding() || this.editingId() !== null);
  readonly canSubmit = computed(
    () => !this.busy() && this.draft().name.trim().length > 0
  );

  patch(change: Partial<LocationRequest>) {
    this.draft.update((draft) => ({ ...draft, ...change }));
  }

  startAdding() {
    this.editingId.set(null);
    this.draft.set(emptyDraft());
    this.adding.set(true);
  }

  startEditing(location: Location) {
    this.adding.set(false);
    const { id, ...request } = location;
    this.draft.set({ ...request });
    this.editingId.set(location.id);
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
        await this.locationsService.updateLocation(editingId, this.draft());
      } else {
        await this.locationsService.addLocation(this.draft());
      }
      this.cancel();
    } finally {
      this.busy.set(false);
    }
  }

  async remove(location: Location) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.locationsService.deleteLocation(location.id);
    } finally {
      this.busy.set(false);
    }
  }
}
