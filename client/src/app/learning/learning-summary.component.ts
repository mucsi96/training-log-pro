import { Component, computed, inject, resource, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { LearningPath, LearningPathService } from './learning-path.service';

@Component({
  standalone: true,
  selector: 'app-learning-summary',
  imports: [MatCheckboxModule, MatIconModule, RouterLink, BarLoaderComponent],
  templateUrl: './learning-summary.component.html',
  styleUrl: './learning-summary.component.css',
})
export class LearningSummaryComponent {
  private readonly service = inject(LearningPathService);

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

  readonly activeIds = computed(
    () =>
      new Set(
        (this.today.value() ?? [])
          .filter((path) => path.active)
          .map((path) => path.id)
      )
  );

  isActive(id: string): boolean {
    return this.activeIds().has(id);
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
