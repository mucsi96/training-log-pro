import { Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Book, ReadingService } from './reading.service';

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
  selector: 'app-reading-library',
  templateUrl: './reading-library.component.html',
  styleUrl: './reading-library.component.css',
})
export class ReadingLibraryComponent {
  private readonly readingService = inject(ReadingService);

  readonly busy = signal(false);
  readonly addingBook = signal(false);
  readonly draft = signal<NewBookDraft>({ title: '', author: '', totalPages: null });

  readonly books = resource({
    params: () => this.readingService.version(),
    loader: () => this.readingService.getBooks(),
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

  async deleteBook(book: Book) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.readingService.deleteBook(book.id);
    } finally {
      this.busy.set(false);
    }
  }

  ariaForBook(book: Book): string {
    return `${book.title}, ${book.currentPage} of ${book.totalPages} pages`;
  }

  averageLabel(book: Book): string | null {
    if (book.averagePagesPerDay === undefined || book.averagePagesPerDay === null) {
      return null;
    }
    return `${book.averagePagesPerDay.toFixed(1)} pages/day avg`;
  }
}
