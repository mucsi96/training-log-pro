import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import Nexus from 'nexusui';

export type PushupsAddDialogData = {
  defaultSetSize: number;
  maxSetSize: number;
};

export type PushupsAddDialogResult = number | null;

@Component({
  standalone: true,
  selector: 'app-pushups-add-dialog',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './pushups-add-dialog.component.html',
  styleUrl: './pushups-add-dialog.component.css',
})
export class PushupsAddDialogComponent implements AfterViewInit, OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<PushupsAddDialogComponent, PushupsAddDialogResult>>(MatDialogRef);
  readonly data = inject<PushupsAddDialogData>(MAT_DIALOG_DATA);

  private readonly dialContainer = viewChild.required<ElementRef<HTMLDivElement>>('dial');
  private dial?: InstanceType<typeof Nexus.Dial>;

  readonly count = signal(this.data.defaultSetSize);

  ngAfterViewInit(): void {
    const dial = new Nexus.Dial(this.dialContainer().nativeElement, {
      size: [220, 220],
      interaction: 'radial',
      mode: 'absolute',
      min: 1,
      max: this.data.maxSetSize,
      step: 1,
      value: this.data.defaultSetSize,
    });
    dial.colorize('accent', 'hsl(220, 89%, 53%)');
    dial.colorize('fill', 'hsl(217, 19%, 27%)');
    dial.on('change', (value) => this.count.set(Math.round(value)));
    this.dial = dial;
  }

  ngOnDestroy(): void {
    this.dial?.destroy();
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  add(): void {
    this.dialogRef.close(this.count());
  }
}
