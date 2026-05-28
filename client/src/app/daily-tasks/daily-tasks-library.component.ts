import { Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { DailyTask, DailyTasksService } from './daily-tasks.service';

@Component({
  standalone: true,
  selector: 'app-daily-tasks-library',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    BarLoaderComponent,
  ],
  templateUrl: './daily-tasks-library.component.html',
  styleUrl: './daily-tasks-library.component.css',
})
export class DailyTasksLibraryComponent {
  private readonly tasksService = inject(DailyTasksService);

  readonly busy = signal(false);
  readonly addingTask = signal(false);
  readonly editingTaskId = signal<string | null>(null);
  readonly draft = signal('');

  readonly tasks = resource({
    params: () => this.tasksService.version(),
    loader: () => this.tasksService.listTasks(),
  });

  readonly canSubmit = computed(
    () => !this.busy() && this.draft().trim().length > 0
  );

  startAddingTask() {
    this.editingTaskId.set(null);
    this.draft.set('');
    this.addingTask.set(true);
  }

  startEditingTask(task: DailyTask) {
    this.addingTask.set(false);
    this.draft.set(task.name);
    this.editingTaskId.set(task.id);
  }

  cancelForm() {
    if (this.editingTaskId() !== null) {
      this.editingTaskId.set(null);
    } else {
      this.addingTask.set(false);
    }
    this.draft.set('');
  }

  async submitTask() {
    if (!this.canSubmit()) return;
    const name = this.draft().trim();
    const editingId = this.editingTaskId();
    this.busy.set(true);
    try {
      if (editingId !== null) {
        await this.tasksService.renameTask(editingId, name);
        this.editingTaskId.set(null);
      } else {
        await this.tasksService.addTask(name);
        this.addingTask.set(false);
      }
      this.draft.set('');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteTask(task: DailyTask) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.tasksService.deleteTask(task.id);
    } finally {
      this.busy.set(false);
    }
  }
}
