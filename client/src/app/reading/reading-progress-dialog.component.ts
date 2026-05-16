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
import { DonutSliderComponent } from '@mucsi96/angular-material-theme';
import { Book } from './reading.service';

export type ReadingProgressDialogData = {
  book: Book;
};

export type ReadingProgressDialogResult = number | null;

@Component({
  standalone: true,
  selector: 'app-reading-progress-dialog',
  imports: [MatButtonModule, MatDialogModule, DonutSliderComponent],
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
  readonly pageUnit = `/ ${this.book.totalPages}`;

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
