import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  BarLoaderComponent,
  NotificationsService,
} from '@mucsi96/angular-material-theme';
import { Book, ReadingService } from './reading.service';

type BookDraft = {
  title: string;
  author: string;
  totalPages: number | null;
  startingPage: number | null;
};

const emptyDraft = (): BookDraft => ({
  title: '',
  author: '',
  totalPages: null,
  startingPage: null,
});

@Component({
  standalone: true,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    BarLoaderComponent,
  ],
  selector: 'app-reading-library',
  templateUrl: './reading-library.component.html',
  styleUrl: './reading-library.component.css',
})
export class ReadingLibraryComponent {
  private readonly readingService = inject(ReadingService);
  private readonly notifications = inject(NotificationsService);

  readonly busy = signal(false);
  readonly addingBook = signal(false);
  readonly editingBookId = signal<string | null>(null);
  readonly draft = signal<BookDraft>(emptyDraft());

  readonly books = resource({
    params: () => this.readingService.version(),
    loader: () => this.readingService.getBooks(),
  });

  readonly inProgressBooks = computed(
    () =>
      this.books.value()?.filter(
        (book) => book.totalPages !== null && !book.completedAt
      ) ?? []
  );
  readonly completedBooks = computed(
    () => this.books.value()?.filter((book) => !!book.completedAt) ?? []
  );
  readonly wantedBooks = computed(
    () => this.books.value()?.filter((book) => book.totalPages === null) ?? []
  );

  readonly canSubmit = computed(() => {
    const d = this.draft();
    if (this.busy()) return false;
    if (d.title.trim().length === 0 || d.author.trim().length === 0) {
      return false;
    }
    if (d.totalPages === null) {
      return (d.startingPage ?? 0) === 0;
    }
    if (d.totalPages <= 0) return false;
    const startingPage = d.startingPage ?? 0;
    return startingPage >= 0 && startingPage < d.totalPages;
  });

  startAddingBook() {
    this.editingBookId.set(null);
    this.draft.set(emptyDraft());
    this.addingBook.set(true);
  }

  startEditingBook(book: Book) {
    this.addingBook.set(false);
    this.draft.set({
      title: book.title,
      author: book.author,
      totalPages: book.totalPages,
      startingPage: book.startingPage,
    });
    this.editingBookId.set(book.id);
  }

  cancelForm() {
    if (this.editingBookId() !== null) {
      this.editingBookId.set(null);
    } else {
      this.addingBook.set(false);
    }
  }

  updateDraft<K extends keyof BookDraft>(field: K, value: BookDraft[K]) {
    this.draft.update((d) => {
      const next = { ...d, [field]: value };
      if (field === 'totalPages' && value === null) {
        next.startingPage = null;
      }
      return next;
    });
  }

  async submitBook() {
    if (!this.canSubmit()) return;
    const d = this.draft();
    const editingId = this.editingBookId();
    this.busy.set(true);
    try {
      if (editingId) {
        await this.readingService.updateBook(
          editingId,
          d.title.trim(),
          d.author.trim(),
          d.totalPages,
          d.startingPage ?? 0
        );
        this.editingBookId.set(null);
      } else {
        await this.readingService.addBook(
          d.title.trim(),
          d.author.trim(),
          d.totalPages,
          d.startingPage ?? 0
        );
        this.addingBook.set(false);
      }
    } finally {
      this.busy.set(false);
    }
  }

  async copyBook(book: Book) {
    const text = `${book.author} - ${book.title}`;
    try {
      await navigator.clipboard.writeText(text);
      this.notifications.success('Copied to clipboard');
    } catch {
      this.notifications.error('Unable to copy to clipboard');
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
    if (book.totalPages === null) {
      return `${book.title}, wanted`;
    }
    return `${book.title}, ${book.currentPage} of ${book.totalPages} pages`;
  }

  averageLabel(book: Book): string | null {
    if (book.averagePagesPerDay === undefined || book.averagePagesPerDay === null) {
      return null;
    }
    return `${book.averagePagesPerDay.toFixed(1)} pages/day avg`;
  }
}
