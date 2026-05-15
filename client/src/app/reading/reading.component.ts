import { Component, computed, inject, resource, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  ReadingProgressDialogComponent,
  ReadingProgressDialogData,
  ReadingProgressDialogResult,
} from './reading-progress-dialog.component';
import { Book, ReadingService } from './reading.service';

@Component({
  standalone: true,
  imports: [MatProgressSpinnerModule],
  selector: 'app-reading',
  templateUrl: './reading.component.html',
  styleUrl: './reading.component.css',
})
export class ReadingComponent {
  private readonly readingService = inject(ReadingService);
  private readonly dialog = inject(MatDialog);

  readonly busy = signal(false);

  readonly books = resource({
    params: () => this.readingService.version(),
    loader: () => this.readingService.getBooks(),
  });

  readonly inProgressBooks = computed(
    () => this.books.value()?.filter((book) => !book.completedAt) ?? []
  );

  bookProgressPercent(book: Book): number {
    return book.totalPages > 0
      ? Math.min(100, (book.currentPage / book.totalPages) * 100)
      : 0;
  }

  ariaForBook(book: Book): string {
    return `${book.title}, ${book.currentPage} of ${book.totalPages} pages`;
  }

  daysLabel(book: Book): string {
    if (book.estimatedDaysRemaining === undefined || book.estimatedDaysRemaining === null) {
      return '–';
    }
    return String(book.estimatedDaysRemaining);
  }

  daysUnit(book: Book): string {
    if (book.estimatedDaysRemaining === 1) {
      return 'day left';
    }
    return 'days left';
  }

  averageLabel(book: Book): string {
    if (book.averagePagesPerDay === undefined || book.averagePagesPerDay === null) {
      return '–';
    }
    return book.averagePagesPerDay.toFixed(1);
  }

  openProgressDialog(book: Book): void {
    if (this.busy()) {
      return;
    }
    const ref = this.dialog.open<
      ReadingProgressDialogComponent,
      ReadingProgressDialogData,
      ReadingProgressDialogResult
    >(ReadingProgressDialogComponent, {
      data: { book },
      autoFocus: 'dialog',
      restoreFocus: true,
    });
    ref.afterClosed().subscribe((page) => {
      if (typeof page === 'number' && page !== book.currentPage) {
        this.updateProgress(book, page);
      }
    });
  }

  private async updateProgress(book: Book, page: number) {
    this.busy.set(true);
    try {
      await this.readingService.updateProgress(book.id, page);
    } finally {
      this.busy.set(false);
    }
  }
}
