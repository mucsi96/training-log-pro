import { DatePipe } from '@angular/common';
import { Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { ApiToken, ApiTokensService } from './api-tokens.service';

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
  selector: 'app-api-tokens',
  templateUrl: './api-tokens.component.html',
  styleUrl: './api-tokens.component.css',
})
export class ApiTokensComponent {
  private readonly apiTokensService = inject(ApiTokensService);

  readonly busy = signal(false);
  readonly name = signal('');

  readonly tokens = resource({
    params: () => this.apiTokensService.version(),
    loader: () => this.apiTokensService.getTokens(),
  });

  readonly tokensList = computed(() => this.tokens.value() ?? []);
  readonly canCreate = computed(
    () => !this.busy() && this.name().trim().length > 0
  );

  async createToken() {
    if (!this.canCreate()) return;
    this.busy.set(true);
    try {
      const token = await this.apiTokensService.createToken(this.name().trim());
      this.downloadTokenFile(token);
      this.name.set('');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteToken(token: ApiToken) {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.apiTokensService.deleteToken(token.id);
    } finally {
      this.busy.set(false);
    }
  }

  private downloadTokenFile(token: string) {
    const blob = new Blob([token], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'training-log.token';
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
