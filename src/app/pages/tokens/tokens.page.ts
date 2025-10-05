import {Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonText
} from '@ionic/angular/standalone';
import {environment} from "../../../environments/environment";
import {HttpClient} from "@angular/common/http";
import {PAT} from "../../shared/models/pat";

@Component({
  selector: 'app-tokens',
  templateUrl: './tokens.page.html',
  styleUrls: ['./tokens.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonButton, IonText, IonCardContent, IonCardHeader, IonCardTitle, IonCard, IonList, IonLabel, IonItem]
})
export class TokensPage {
  private http: HttpClient = inject(HttpClient);
  list: PAT[] = [];
  justCreatedToken: string | null = null;

  async ionViewWillEnter() { await this.reload(); }

  async reload(): Promise<void> {
    this.list = await this.http.get<PAT[]>(`${environment.apiBaseUrl}/api/v1/tokens`, { withCredentials: true }).toPromise() as PAT[];
  }

  async create(): Promise<void> {
    const body = { label: 'ui-token', scopes: ['links:read','links:write','links:delete'] };
    const res = await this.http.post<any>(`${environment.apiBaseUrl}/api/v1/tokens`, body, { withCredentials: true }).toPromise();
    this.justCreatedToken = res?.token || null; // montré une seule fois
    await this.reload();
  }

  async revoke(id: number | undefined): Promise<void> {
    if (!id) return;
    await this.http.delete(`${environment.apiBaseUrl}/api/v1/tokens/${id}`, { withCredentials: true }).toPromise();
    await this.reload();
  }
}
