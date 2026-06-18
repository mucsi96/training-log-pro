import { Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import {
  LearningPath,
  LearningPathContent,
  LearningPathService,
} from './learning-path.service';
import { blockIcon } from './block-icon';

@Component({
  standalone: true,
  selector: 'app-learning-path-library',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    BarLoaderComponent,
  ],
  templateUrl: './learning-path-library.component.html',
  styleUrl: './learning-path-library.component.css',
})
export class LearningPathLibraryComponent {
  private readonly service = inject(LearningPathService);

  readonly editing = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly title = signal('');
  readonly prompt = signal('');
  readonly preview = signal<LearningPathContent | null>(null);
  readonly generating = signal(false);
  readonly saving = signal(false);

  readonly paths = resource({
    params: () => this.service.version(),
    loader: () => this.service.getPaths(),
  });

  readonly busy = computed(() => this.generating() || this.saving());
  readonly canGenerate = computed(
    () => !this.busy() && this.prompt().trim().length > 0
  );
  readonly canSave = computed(
    () =>
      !this.busy() && this.title().trim().length > 0 && this.preview() !== null
  );
  readonly generateLabel = computed(() =>
    this.preview() ? 'Refine with AI' : 'Generate with AI'
  );

  readonly blockIcon = blockIcon;

  startCreate() {
    this.editingId.set(null);
    this.title.set('');
    this.prompt.set('');
    this.preview.set(null);
    this.editing.set(true);
  }

  startEdit(path: LearningPath) {
    this.editingId.set(path.id);
    this.title.set(path.title);
    this.prompt.set('');
    this.preview.set(path.content);
    this.editing.set(true);
  }

  cancel() {
    this.editing.set(false);
    this.editingId.set(null);
    this.title.set('');
    this.prompt.set('');
    this.preview.set(null);
  }

  async generate() {
    if (!this.canGenerate()) {
      return;
    }
    this.generating.set(true);
    try {
      const content = await this.service.generate(
        this.prompt().trim(),
        this.preview() ?? undefined
      );
      this.preview.set(content);
      this.prompt.set('');
    } finally {
      this.generating.set(false);
    }
  }

  async save() {
    const content = this.preview();
    if (!this.canSave() || !content) {
      return;
    }
    this.saving.set(true);
    try {
      const editingId = this.editingId();
      if (editingId) {
        await this.service.updatePath(editingId, this.title().trim(), content);
      } else {
        await this.service.savePath(this.title().trim(), content);
      }
      this.cancel();
    } finally {
      this.saving.set(false);
    }
  }

  async deletePath(path: LearningPath) {
    if (this.busy()) {
      return;
    }
    this.saving.set(true);
    try {
      await this.service.deletePath(path.id);
    } finally {
      this.saving.set(false);
    }
  }
}
