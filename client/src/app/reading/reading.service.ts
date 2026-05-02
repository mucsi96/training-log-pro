import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { fetchJson } from '../utils/fetchJson';

export type Book = {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  averagePagesPerDay?: number;
  estimatedDaysRemaining?: number;
};

type BookDto = {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  averagePagesPerDay?: number;
  estimatedDaysRemaining?: number;
};

export type ReadingStats = {
  todayPages: number;
  dailyPagesGoal: number;
  goalReached: boolean;
};

const toBook = (dto: BookDto): Book => ({
  ...dto,
  createdAt: new Date(dto.createdAt),
  startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
  completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
});

@Injectable({ providedIn: 'root' })
export class ReadingService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  readonly version = signal(0);

  async getBooks(): Promise<Book[]> {
    try {
      const books = await fetchJson<BookDto[]>(this.http, '/api/reading/books');
      return books.map(toBook);
    } catch (e) {
      this.showError('Unable to fetch books');
      throw e;
    }
  }

  async getStats(): Promise<ReadingStats> {
    try {
      return await fetchJson<ReadingStats>(this.http, '/api/reading/stats');
    } catch (e) {
      this.showError('Unable to fetch reading stats');
      throw e;
    }
  }

  async addBook(title: string, author: string, totalPages: number): Promise<Book> {
    try {
      const book = await fetchJson<BookDto>(this.http, '/api/reading/books', {
        method: 'post',
        body: { title, author, totalPages },
      });
      this.version.update((v) => v + 1);
      return toBook(book);
    } catch (e) {
      this.showError('Unable to add book');
      throw e;
    }
  }

  async updateProgress(bookId: string, currentPage: number): Promise<Book> {
    try {
      const book = await fetchJson<BookDto>(
        this.http,
        `/api/reading/books/${bookId}/progress`,
        { method: 'post', body: { currentPage } }
      );
      this.version.update((v) => v + 1);
      return toBook(book);
    } catch (e) {
      this.showError('Unable to update progress');
      throw e;
    }
  }

  async deleteBook(bookId: string): Promise<void> {
    try {
      await fetchJson<void>(this.http, `/api/reading/books/${bookId}`, {
        method: 'delete',
      });
      this.version.update((v) => v + 1);
    } catch (e) {
      this.showError('Unable to delete book');
      throw e;
    }
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      verticalPosition: 'top',
      panelClass: ['error'],
    });
  }
}
