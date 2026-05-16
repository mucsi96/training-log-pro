import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DonutSliderComponent } from '@mucsi96/angular-material-theme';

export type PushupsAddDialogResult = number | null;

@Component({
  standalone: true,
  selector: 'app-pushups-add-dialog',
  imports: [MatButtonModule, MatDialogModule, DonutSliderComponent],
  templateUrl: './pushups-add-dialog.component.html',
  styleUrl: './pushups-add-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PushupsAddDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<PushupsAddDialogComponent, PushupsAddDialogResult>>(MatDialogRef);

  readonly count = signal(0);
  readonly canAdd = computed(() => this.count() > 0);

  cancel(): void {
    this.dialogRef.close(null);
  }

  add(): void {
    if (!this.canAdd()) {
      return;
    }
    this.dialogRef.close(this.count());
  }
}
