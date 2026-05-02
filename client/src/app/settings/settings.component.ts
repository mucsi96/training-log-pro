import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { form, FormField, FormRoot, max, min, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Book, ReadingService } from '../reading/reading.service';
import { GoldenDayGoal, SettingsService } from './settings.service';

type NewBookDraft = {
  title: string;
  author: string;
  totalPages: number | null;
};

@Component({
  standalone: true,
  selector: 'app-settings',
  imports: [
    FormField,
    FormRoot,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly readingService = inject(ReadingService);

  readonly goal = resource({
    params: () => this.settingsService.version(),
    loader: () => this.settingsService.getGoldenDayGoal(),
  });

  readonly books = resource({
    params: () => this.readingService.version(),
    loader: () => this.readingService.getBooks(),
  });

  readonly model = signal<GoldenDayGoal>({
    pushupGoal: 100,
    elevationGoal: 250,
    readingPagesGoal: 0,
  });

  readonly goalForm = form(this.model, (path) => {
    required(path.pushupGoal);
    min(path.pushupGoal, 1);
    max(path.pushupGoal, 10000);
    required(path.elevationGoal);
    min(path.elevationGoal, 1);
    max(path.elevationGoal, 100000);
    required(path.readingPagesGoal);
    min(path.readingPagesGoal, 0);
    max(path.readingPagesGoal, 10000);
  });

  readonly saving = signal(false);
  readonly canSave = computed(
    () => !this.saving() && this.goalForm().valid()
  );

  readonly bookBusy = signal(false);
  readonly addingBook = signal(false);
  readonly draft = signal<NewBookDraft>({ title: '', author: '', totalPages: null });

  readonly canSubmitBook = computed(() => {
    const d = this.draft();
    return (
      !this.bookBusy() &&
      d.title.trim().length > 0 &&
      d.author.trim().length > 0 &&
      typeof d.totalPages === 'number' &&
      d.totalPages > 0
    );
  });

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

  startAddingBook() {
    this.draft.set({ title: '', author: '', totalPages: null });
    this.addingBook.set(true);
  }

  cancelAddingBook() {
    this.addingBook.set(false);
  }

  updateDraft<K extends keyof NewBookDraft>(field: K, value: NewBookDraft[K]) {
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  async submitBook() {
    if (!this.canSubmitBook()) return;
    const d = this.draft();
    this.bookBusy.set(true);
    try {
      await this.readingService.addBook(
        d.title.trim(),
        d.author.trim(),
        d.totalPages as number
      );
      this.addingBook.set(false);
    } finally {
      this.bookBusy.set(false);
    }
  }

  async deleteBook(book: Book) {
    if (this.bookBusy()) return;
    this.bookBusy.set(true);
    try {
      await this.readingService.deleteBook(book.id);
    } finally {
      this.bookBusy.set(false);
    }
  }
}
