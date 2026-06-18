import { Component, computed, inject, resource, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { LearningPath, LearningPathService } from './learning-path.service';
import { blockIcon } from './block-icon';

@Component({
  standalone: true,
  selector: 'app-learning',
  imports: [MatCheckboxModule, MatIconModule, BarLoaderComponent],
  templateUrl: './learning.component.html',
  styleUrl: './learning.component.css',
})
export class LearningComponent {
  private readonly service = inject(LearningPathService);

  readonly togglingBlockId = signal<string | null>(null);
  readonly togglingActivityId = signal<string | null>(null);

  readonly paths = resource({
    params: () => this.service.version(),
    loader: () => this.service.getPaths(),
  });

  readonly today = resource({
    params: () => this.service.version(),
    loader: () => this.service.getToday(),
  });

  readonly hasPaths = computed(() => (this.paths.value()?.length ?? 0) > 0);

  readonly blockIcon = blockIcon;

  isActive(id: string): boolean {
    return this.today.value()?.find((path) => path.id === id)?.active ?? false;
  }

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

  async toggleActivity(path: LearningPath, active: boolean) {
    if (this.togglingActivityId() !== null) {
      return;
    }
    this.togglingActivityId.set(path.id);
    try {
      await this.service.setActivity(path.id, active);
    } finally {
      this.togglingActivityId.set(null);
    }
  }
}
