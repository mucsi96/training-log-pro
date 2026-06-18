import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { LearningPath, LearningPathService } from './learning-path.service';
import { blockIcon } from './block-icon';

@Component({
  standalone: true,
  selector: 'app-learning-path',
  imports: [MatCheckboxModule, MatIconModule, RouterLink, BarLoaderComponent],
  templateUrl: './learning-path.component.html',
  styleUrl: './learning-path.component.css',
})
export class LearningPathComponent {
  private readonly service = inject(LearningPathService);

  readonly id = input.required<string>();

  readonly togglingBlockId = signal<string | null>(null);

  readonly path = resource({
    params: () => ({ id: this.id(), version: this.service.version() }),
    loader: ({ params }) => this.service.getPath(params.id),
  });

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
}
