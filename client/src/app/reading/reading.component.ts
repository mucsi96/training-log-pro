import { Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Book, ReadingService } from './reading.service';
import { SettingsService } from '../settings/settings.service';

type NewBookDraft = {
  title: string;
  author: string;
  totalPages: number | null;
};

@Component({
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-reading',
  templateUrl: './reading.component.html',
  styleUrl: './reading.component.css',
})
export class ReadingComponent {
  private readonly readingService = inject(ReadingService);
  private readonly settingsService = inject(SettingsService);

  readonly busy = signal(false);
  readonly addingBook = signal(false);
  readonly draft = signal<NewBookDraft>({ title: '', author: '', totalPages: null });
  readonly progressInputs = signal<Record<string, number>>({});

  readonly goldenDayGoal = resource({
    params: () => this.settingsService.version(),
    loader: () => this.settingsService.getGoldenDayGoal(),
  });

  readonly books = resource({
    params: () => this.readingService.version(),
    loader: () => this.readingService.getBooks(),
  });

  readonly stats = resource({
    params: () => ({
      books: this.readingService.version(),
      settings: this.settingsService.version(),
    }),
    loader: () => this.readingService.getStats(),
  });

  readonly dailyGoal = computed(() => this.goldenDayGoal.value()?.readingPagesGoal ?? 0);
  readonly todayPages = computed(() => this.stats.value()?.todayPages ?? 0);
  readonly remaining = computed(() => Math.max(0, this.dailyGoal() - this.todayPages()));
  readonly goalReached = computed(
    () => this.dailyGoal() > 0 && this.todayPages() >= this.dailyGoal()
  );
  readonly progressPercent = computed(() => {
    const goal = this.dailyGoal();
    return goal > 0 ? Math.min(100, (this.todayPages() / goal) * 100) : 0;
  });

  readonly inProgressBooks = computed(
    () => this.books.value()?.filter((book) => !book.completedAt) ?? []
  );
  readonly completedBooks = computed(
    () => this.books.value()?.filter((book) => book.completedAt) ?? []
  );

  readonly canSubmit = computed(() => {
    const d = this.draft();
    return (
      !this.busy() &&
      d.title.trim().length > 0 &&
      d.author.trim().length > 0 &&
      typeof d.totalPages === 'number' &&
      d.totalPages > 0
    );
  });

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
    if (!this.canSubmit()) return;
    const d = this.draft();
    this.busy.set(true);
    try {
      await this.readingService.addBook(
        d.title.trim(),
        d.author.trim(),
        d.totalPages as number
      );
      this.addingBook.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  pageInputValue(book: Book): number {
    return this.progressInputs()[book.id] ?? book.currentPage;
  }

  setPageInput(book: Book, value: number) {
    this.progressInputs.update((map) => ({ ...map, [book.id]: value }));
  }

  async saveProgress(book: Book) {
    const value = this.pageInputValue(book);
    if (this.busy() || value === book.currentPage) return;
    if (value < 0 || value > book.totalPages) return;
    this.busy.set(true);
    try {
      await this.readingService.updateProgress(book.id, value);
      this.progressInputs.update((map) => {
        const next = { ...map };
        delete next[book.id];
        return next;
      });
    } finally {
      this.busy.set(false);
    }
  }

  async deleteBook(book: Book) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.readingService.deleteBook(book.id);
    } finally {
      this.busy.set(false);
    }
  }

  bookProgressPercent(book: Book): number {
    return book.totalPages > 0
      ? Math.min(100, (book.currentPage / book.totalPages) * 100)
      : 0;
  }

  ariaForBook(book: Book): string {
    return `${book.title}, ${book.currentPage} of ${book.totalPages} pages`;
  }

  estimatedFinishLabel(book: Book): string | null {
    if (book.completedAt) {
      return 'Finished';
    }
    if (book.estimatedDaysRemaining === undefined || book.estimatedDaysRemaining === null) {
      return null;
    }
    if (book.estimatedDaysRemaining === 0) {
      return 'Ready to finish';
    }
    if (book.estimatedDaysRemaining === 1) {
      return 'About 1 day to finish';
    }
    return `About ${book.estimatedDaysRemaining} days to finish`;
  }

  averageLabel(book: Book): string | null {
    if (book.averagePagesPerDay === undefined || book.averagePagesPerDay === null) {
      return null;
    }
    return `${book.averagePagesPerDay.toFixed(1)} pages/day avg`;
  }
}
