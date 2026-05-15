import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CircularSliderComponent } from '../circular-slider/circular-slider.component';

export type PushupsAddDialogData = {
  defaultSetSize: number;
  maxSetSize: number;
};

export type PushupsAddDialogResult = number | null;

@Component({
  standalone: true,
  selector: 'app-pushups-add-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, CircularSliderComponent],
  templateUrl: './pushups-add-dialog.component.html',
  styleUrl: './pushups-add-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PushupsAddDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<PushupsAddDialogComponent, PushupsAddDialogResult>>(MatDialogRef);
  readonly data = inject<PushupsAddDialogData>(MAT_DIALOG_DATA);

  readonly min = 1;
  readonly count = signal(this.data.defaultSetSize);

  cancel(): void {
    this.dialogRef.close(null);
  }

  add(): void {
    this.dialogRef.close(this.count());
  }
}
