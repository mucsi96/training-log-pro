import { DatePipe } from '@angular/common';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { Device, DevicesService } from './devices.service';

@Component({
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    BarLoaderComponent,
  ],
  selector: 'app-devices',
  templateUrl: './devices.component.html',
  styleUrl: './devices.component.css',
})
export class DevicesComponent {
  private readonly devicesService = inject(DevicesService);

  readonly busy = signal(false);
  readonly name = signal('');
  readonly dragOverDeviceId = signal<string | null>(null);
  readonly uploadingDeviceId = signal<string | null>(null);

  readonly devices = resource({
    params: () => this.devicesService.version(),
    loader: () => this.devicesService.getDevices(),
  });

  readonly devicesList = computed(() => this.devices.value() ?? []);
  readonly canCreate = computed(
    () => !this.busy() && this.name().trim().length > 0
  );

  async createDevice() {
    if (!this.canCreate()) return;
    this.busy.set(true);
    try {
      const apiKey = await this.devicesService.createDevice(this.name().trim());
      this.downloadKeyFile(apiKey);
      this.name.set('');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteDevice(device: Device) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.devicesService.deleteDevice(device.id);
    } finally {
      this.busy.set(false);
    }
  }

  async removeBook(device: Device, bookId: string) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.devicesService.removeBook(device.id, bookId);
    } finally {
      this.busy.set(false);
    }
  }

  onDragOver(event: DragEvent, device: Device) {
    event.preventDefault();
    this.dragOverDeviceId.set(device.id);
  }

  onDragLeave(event: DragEvent, device: Device) {
    event.preventDefault();
    if (this.dragOverDeviceId() === device.id) {
      this.dragOverDeviceId.set(null);
    }
  }

  async onDrop(event: DragEvent, device: Device) {
    event.preventDefault();
    this.dragOverDeviceId.set(null);
    const files = [...(event.dataTransfer?.files ?? [])];
    await this.sendFiles(device, files);
  }

  async onFilesPicked(event: Event, device: Device) {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    await this.sendFiles(device, files);
  }

  private async sendFiles(device: Device, files: File[]) {
    if (files.length === 0 || this.uploadingDeviceId()) return;
    this.uploadingDeviceId.set(device.id);
    try {
      for (const file of files) {
        await this.devicesService.sendBook(device.id, file);
      }
    } finally {
      this.uploadingDeviceId.set(null);
    }
  }

  private downloadKeyFile(apiKey: string) {
    const blob = new Blob([apiKey], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'training-log.key';
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
