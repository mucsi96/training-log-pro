import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { fetchJson } from '../utils/fetchJson';

export type ApiToken = {
  id: string;
  name: string;
  createdAt: Date;
};

type ApiTokenDto = {
  id: string;
  name: string;
  createdAt: string;
};

type CreatedApiTokenDto = ApiTokenDto & {
  token: string;
};

const toApiToken = (dto: ApiTokenDto): ApiToken => ({
  ...dto,
  createdAt: new Date(dto.createdAt),
});

@Injectable({ providedIn: 'root' })
export class ApiTokensService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);
  readonly version = signal(0);

  async getTokens(): Promise<ApiToken[]> {
    try {
      const tokens = await fetchJson<ApiTokenDto[]>(this.http, '/api/api-tokens');
      return tokens.map(toApiToken);
    } catch (e) {
      this.notifications.error('Unable to fetch API tokens');
      throw e;
    }
  }

  async createToken(name: string): Promise<string> {
    try {
      const created = await fetchJson<CreatedApiTokenDto>(
        this.http,
        '/api/api-tokens',
        { method: 'post', body: { name } }
      );
      this.version.update((v) => v + 1);
      return created.token;
    } catch (e) {
      this.notifications.error('Unable to create API token');
      throw e;
    }
  }

  async deleteToken(tokenId: string): Promise<void> {
    try {
      await fetchJson<void>(this.http, `/api/api-tokens/${tokenId}`, {
        method: 'delete',
      });
      this.version.update((v) => v + 1);
    } catch (e) {
      this.notifications.error('Unable to delete API token');
      throw e;
    }
  }
}
