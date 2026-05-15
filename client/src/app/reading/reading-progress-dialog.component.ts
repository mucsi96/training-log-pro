import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { CircularSliderComponent } from '../circular-slider/circular-slider.component';
import { Book } from './reading.service';

export type ReadingProgressDialogData = {
  book: Book;
};

export type ReadingProgressDialogResult = number | null;

@Component({
  standalone: true,
  selector: 'app-reading-progress-dialog',
  imports: [MatButtonModule, MatDialogModule, CircularSliderComponent],
  templateUrl: './reading-progress-dialog.component.html',
  styleUrl: './reading-progress-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadingProgressDialogComponent {
  private readonly dialogRef = inject<
    MatDialogRef<ReadingProgressDialogComponent, ReadingProgressDialogResult>
  >(MatDialogRef);
  readonly data = inject<ReadingProgressDialogData>(MAT_DIALOG_DATA);

  readonly book = this.data.book;
  readonly page = signal(this.book.currentPage);
  readonly canSave = computed(() => this.page() !== this.book.currentPage);
  readonly ariaLabel = `Current page for ${this.book.title}`;

  cancel(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (!this.canSave()) {
      return;
    }
    this.dialogRef.close(this.page());
  }
}
