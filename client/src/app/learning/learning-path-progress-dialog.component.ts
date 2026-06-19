import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export type LearningPathProgressDialogData = {
  title: string;
};

export type LearningPathProgressDialogResult = {
  durationMinutes: number;
  description: string;
  comment?: string;
} | null;

@Component({
  standalone: true,
  selector: 'app-learning-path-progress-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './learning-path-progress-dialog.component.html',
  styleUrl: './learning-path-progress-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearningPathProgressDialogComponent {
  private readonly dialogRef = inject<
    MatDialogRef<
      LearningPathProgressDialogComponent,
      LearningPathProgressDialogResult
    >
  >(MatDialogRef);
  readonly data = inject<LearningPathProgressDialogData>(MAT_DIALOG_DATA);

  readonly durationMinutes = signal<number | null>(null);
  readonly description = signal('');
  readonly comment = signal('');

  readonly canSave = computed(
    () =>
      (this.durationMinutes() ?? 0) > 0 &&
      this.description().trim().length > 0
  );

  cancel(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (!this.canSave()) {
      return;
    }
    const comment = this.comment().trim();
    this.dialogRef.close({
      durationMinutes: this.durationMinutes()!,
      description: this.description().trim(),
      comment: comment.length > 0 ? comment : undefined,
    });
  }
}
