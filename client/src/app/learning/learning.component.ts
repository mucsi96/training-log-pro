import { Component, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { LearningPath, LearningPathService } from './learning-path.service';

@Component({
  standalone: true,
  selector: 'app-learning',
  imports: [RouterLink, BarLoaderComponent],
  templateUrl: './learning.component.html',
  styleUrl: './learning.component.css',
})
export class LearningComponent {
  private readonly service = inject(LearningPathService);

  readonly paths = resource({
    params: () => this.service.version(),
    loader: () => this.service.getPaths(),
  });

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
}
