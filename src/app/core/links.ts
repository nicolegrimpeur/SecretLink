import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpHeaders, HttpParams} from "@angular/common/http";
import {LinkCreateItem, LinkCreateResult} from "../shared/models/link-create";
import {firstValueFrom} from "rxjs";
import {environment} from "../../environments/environment";
import {LinkStatus} from "../shared/models/link-status";
import {RedeemResponse} from "../shared/models/redeem-response";

@Injectable({
  providedIn: 'root'
})
export class LinksService {
  private http = inject(HttpClient);

  async createBulk(items: LinkCreateItem[], opts?: { idempotencyKey?: string }) {
    let headers = new HttpHeaders();
    if (opts?.idempotencyKey) headers = headers.set('Idempotency-Key', opts.idempotencyKey);

    const url = `${environment.apiBaseUrl}/secretLink/links`;
    const res = await firstValueFrom(
      this.http.post<{ results: LinkCreateResult[] }>(url, items, { withCredentials: true, headers })
    );
    return res.results;
  }

  async listStatus(params?: { since?: string; until?: string }, opts?: { pat?: string }) {
    let headers = new HttpHeaders();
    if (opts?.pat) headers = headers.set('Authorization', `Bearer ${opts.pat}`);

    let q = new HttpParams();
    if (params?.since) q = q.set('since', params.since);
    if (params?.until) q = q.set('until', params.until);

    const url = `${environment.apiBaseUrl}/secretLink/links/status`;
    return await firstValueFrom(
      this.http.get<LinkStatus[]>(url, { withCredentials: true, headers, params: q })
    );
  }

  async deleteLink(linkToken: string, opts?: { pat?: string }) {
    let headers = new HttpHeaders();
    if (opts?.pat) headers = headers.set('Authorization', `Bearer ${opts.pat}`);
    const url = `${environment.apiBaseUrl}/secretLink/links/${encodeURIComponent(linkToken)}`;
    await firstValueFrom(this.http.delete(url, { withCredentials: true, headers }));
  }

  async redeemLink(linkToken: string) {
    const url = `${environment.apiBaseUrl}/secretLink/links/redeem/${encodeURIComponent(linkToken)}`;
    return await firstValueFrom(
      this.http.get<RedeemResponse>(url, { withCredentials: false })
    );
  }
}
