import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import {
  LearningPath,
  LearningPathService,
} from './learning-path.service';
import {
  LearningPathProgressDialogComponent,
  LearningPathProgressDialogResult,
} from './learning-path-progress-dialog.component';
import { blockIcon } from './block-icon';

@Component({
  standalone: true,
  selector: 'app-learning-path',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    RouterLink,
    BarLoaderComponent,
  ],
  templateUrl: './learning-path.component.html',
  styleUrl: './learning-path.component.css',
})
export class LearningPathComponent {
  private readonly service = inject(LearningPathService);
  private readonly dialog = inject(MatDialog);

  readonly id = input.required<string>();

  readonly togglingBlockId = signal<string | null>(null);
  readonly logging = signal(false);

  readonly path = resource({
    params: () => ({ id: this.id(), version: this.service.version() }),
    loader: ({ params }) => this.service.getPath(params.id),
  });

  readonly progress = resource({
    params: () => ({ id: this.id(), version: this.service.version() }),
    loader: ({ params }) => this.service.getProgress(params.id),
  });

  readonly latestProgress = computed(() => this.progress.value()?.[0]);

  readonly blockIcon = blockIcon;

  progressDone(path: LearningPath): number {
    return path.content.topics
      .flatMap((topic) => topic.blocks)
      .filter((block) => block.completed).length;
  }

  progressTotal(path: LearningPath): number {
    return path.content.topics.reduce(
      (total, topic) => total + topic.blocks.length,
      0
    );
  }

  async toggleBlock(path: LearningPath, blockId: string, completed: boolean) {
    if (this.togglingBlockId() !== null) {
      return;
    }
    this.togglingBlockId.set(blockId);
    try {
      await this.service.setBlockCompleted(path.id, blockId, completed);
    } finally {
      this.togglingBlockId.set(null);
    }
  }

  openLogDialog(path: LearningPath): void {
    if (this.logging()) {
      return;
    }
    const ref = this.dialog.open<
      LearningPathProgressDialogComponent,
      { title: string },
      LearningPathProgressDialogResult
    >(LearningPathProgressDialogComponent, {
      data: { title: path.title },
      autoFocus: 'dialog',
      restoreFocus: true,
    });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.logProgress(
          path.id,
          result.durationMinutes,
          result.description,
          result.comment
        );
      }
    });
  }

  private async logProgress(
    id: string,
    durationMinutes: number,
    description: string,
    comment?: string
  ) {
    this.logging.set(true);
    try {
      await this.service.logProgress(id, durationMinutes, description, comment);
    } finally {
      this.logging.set(false);
    }
  }
}
