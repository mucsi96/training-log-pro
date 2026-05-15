import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import $ from 'jquery';
import 'round-slider';

export type PushupsAddDialogData = {
  defaultSetSize: number;
  maxSetSize: number;
};

export type PushupsAddDialogResult = number | null;

@Component({
  standalone: true,
  selector: 'app-pushups-add-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './pushups-add-dialog.component.html',
  styleUrl: './pushups-add-dialog.component.css',
})
export class PushupsAddDialogComponent implements AfterViewInit, OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<PushupsAddDialogComponent, PushupsAddDialogResult>>(MatDialogRef);
  private readonly zone = inject(NgZone);
  readonly data = inject<PushupsAddDialogData>(MAT_DIALOG_DATA);

  private readonly sliderHost = viewChild.required<ElementRef<HTMLDivElement>>('slider');
  private slider?: JQuery<HTMLDivElement>;

  readonly count = signal(this.data.defaultSetSize);
  readonly min = 1;

  ngAfterViewInit(): void {
    const update = (value: number) =>
      this.zone.run(() => this.count.set(Math.round(value)));

    this.slider = $(this.sliderHost().nativeElement).roundSlider({
      min: this.min,
      max: this.data.maxSetSize,
      step: 1,
      value: this.data.defaultSetSize,
      radius: 130,
      width: 28,
      handleSize: '+6',
      circleShape: 'full',
      sliderType: 'min-range',
      handleShape: 'round',
      lineCap: 'round',
      showTooltip: false,
      animation: false,
      pathColor: 'hsl(213, 75%, 78%)',
      rangeColor: 'hsl(220, 89%, 53%)',
      borderColor: 'transparent',
      drag: (args) => update(args.value),
      change: (args) => update(args.value),
    }) as JQuery<HTMLDivElement>;
  }

  ngOnDestroy(): void {
    this.slider?.roundSlider('destroy');
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  add(): void {
    this.dialogRef.close(this.count());
  }
}
