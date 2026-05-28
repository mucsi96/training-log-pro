import { Component, computed, inject, resource, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { DailyTasksService } from './daily-tasks.service';

@Component({
  standalone: true,
  selector: 'app-daily-tasks',
  imports: [MatCheckboxModule, BarLoaderComponent],
  templateUrl: './daily-tasks.component.html',
  styleUrl: './daily-tasks.component.css',
})
export class DailyTasksComponent {
  private readonly tasksService = inject(DailyTasksService);

  readonly togglingId = signal<string | null>(null);

  readonly tasks = resource({
    params: () => this.tasksService.version(),
    loader: () => this.tasksService.getToday(),
  });

  readonly hasTasks = computed(() => (this.tasks.value()?.length ?? 0) > 0);
  readonly completedCount = computed(
    () => this.tasks.value()?.filter((t) => t.completed).length ?? 0
  );
  readonly totalCount = computed(() => this.tasks.value()?.length ?? 0);

  async toggle(id: string, completed: boolean) {
    if (this.togglingId() !== null) {
      return;
    }
    this.togglingId.set(id);
    try {
      await this.tasksService.setCompletion(id, completed);
    } finally {
      this.togglingId.set(null);
    }
  }
}
