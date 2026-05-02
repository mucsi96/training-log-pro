import { Component, computed, inject, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { map } from 'rxjs';
import { Book, ReadingService } from './reading.service';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    NgxEchartsModule,
  ],
  selector: 'app-reading',
  templateUrl: './reading.component.html',
  styleUrl: './reading.component.css',
})
export class ReadingComponent {
  private readonly readingService = inject(ReadingService);
  private readonly period = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => (data['period'] as number) ?? 0))
  );

  readonly initOpts = { renderer: 'svg' as const };
  readonly busy = signal(false);
  readonly progressInputs = signal<Record<string, number>>({});

  readonly books = resource({
    params: () => this.readingService.version(),
    loader: () => this.readingService.getBooks(),
  });

  readonly stats = resource({
    params: () => this.readingService.version(),
    loader: () => this.readingService.getStats(),
  });

  readonly dailyProgress = resource({
    params: () => ({ period: this.period(), version: this.readingService.version() }),
    loader: ({ params }) => this.readingService.getDailyProgress(params.period),
  });

  readonly dailyGoal = computed(() => this.stats.value()?.dailyPagesGoal ?? 0);
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

  readonly chartOptions = computed<EChartsOption | undefined>(() => {
    const entries = this.dailyProgress.value();
    if (!entries) {
      return undefined;
    }

    const data = entries
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => [new Date(entry.date), entry.pages]);

    return {
      aria: { enabled: true },
      animation: false,
      grid: { top: 10, right: 10, bottom: 10, left: 10 },
      xAxis: { type: 'time', show: false },
      yAxis: { type: 'value', show: false, min: 0 },
      series: [
        {
          name: 'Pages',
          type: 'bar',
          data,
          itemStyle: { color: 'hsl(220, 89%, 53%)' },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: 'hsl(218, 11%, 65%)', type: 'dashed' },
            data: [{ yAxis: this.dailyGoal() }],
          },
        },
      ],
    };
  });

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

  bookProgressPercent(book: Book): number {
    return book.totalPages > 0
      ? Math.min(100, (book.currentPage / book.totalPages) * 100)
      : 0;
  }

  ariaForBook(book: Book): string {
    return `${book.title}, ${book.currentPage} of ${book.totalPages} pages`;
  }

  estimatedFinishLabel(book: Book): string | null {
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
