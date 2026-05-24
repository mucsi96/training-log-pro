import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { fetchJson } from '../utils/fetchJson';

export type Book = {
  id: string;
  title: string;
  author: string;
  totalPages: number | null;
  startingPage: number;
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
  totalPages?: number | null;
  startingPage: number;
  currentPage: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  averagePagesPerDay?: number;
  estimatedDaysRemaining?: number;
};

const toBook = (dto: BookDto): Book => ({
  ...dto,
  totalPages: dto.totalPages ?? null,
  createdAt: new Date(dto.createdAt),
  startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
  completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
});

@Injectable({ providedIn: 'root' })
export class ReadingService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);
  readonly version = signal(0);

  async getBooks(): Promise<Book[]> {
    try {
      const books = await fetchJson<BookDto[]>(this.http, '/api/reading/books');
      return books.map(toBook);
    } catch (e) {
      this.notifications.error('Unable to fetch books');
      throw e;
    }
  }

  async addBook(
    title: string,
    author: string,
    totalPages: number | null,
    startingPage: number
  ): Promise<Book> {
    try {
      const book = await fetchJson<BookDto>(this.http, '/api/reading/books', {
        method: 'post',
        body: { title, author, totalPages, startingPage },
      });
      this.version.update((v) => v + 1);
      return toBook(book);
    } catch (e) {
      this.notifications.error('Unable to add book');
      throw e;
    }
  }

  async updateBook(
    bookId: string,
    title: string,
    author: string,
    totalPages: number | null,
    startingPage: number
  ): Promise<Book> {
    try {
      const book = await fetchJson<BookDto>(
        this.http,
        `/api/reading/books/${bookId}`,
        { method: 'put', body: { title, author, totalPages, startingPage } }
      );
      this.version.update((v) => v + 1);
      return toBook(book);
    } catch (e) {
      this.notifications.error('Unable to update book');
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
      this.notifications.error('Unable to update progress');
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
      this.notifications.error('Unable to delete book');
      throw e;
    }
  }
}
