import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {PAT} from "../models/pat";
import {environment} from "../../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class PatService {
  private http = inject(HttpClient);

  async list(): Promise<PAT[]> {
    return await firstValueFrom(
      this.http.get<PAT[]>(`${environment.apiBaseUrl}/api/v1/tokens`, { withCredentials: true })
    );
  }

  /** retourne { token, token_preview, pat } ; token est visible UNE SEULE FOIS */
  async create(label: string | null, scopes: string[]) {
    return await firstValueFrom(
      this.http.post<any>(
        `${environment.apiBaseUrl}/api/v1/tokens`,
        { label, scopes },
        { withCredentials: true }
      )
    );
  }

  async revoke(id: number) {
    await firstValueFrom(
      this.http.delete(`${environment.apiBaseUrl}/api/v1/tokens/${id}`, { withCredentials: true })
    );
  }
}
