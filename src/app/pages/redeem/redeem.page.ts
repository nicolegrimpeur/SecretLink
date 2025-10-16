import {Component, inject, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonSkeletonText,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import {HttpClient} from "@angular/common/http";
import {ToastController} from "@ionic/angular";
import {ActivatedRoute, RouterLink} from "@angular/router";
import {environment} from "../../../environments/environment";
import {addIcons} from "ionicons";
import {copyOutline, lockClosedOutline} from "ionicons/icons";
import {RedeemResponse} from "../../shared/models/redeem-response";

@Component({
  selector: 'app-redeem',
  templateUrl: './redeem.page.html',
  styleUrls: ['./redeem.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonCard, IonCardTitle, IonCardHeader, IonCardSubtitle, IonCardContent, IonItem, IonCheckbox, IonButton, IonSkeletonText, IonButtons, IonIcon, RouterLink, IonInput]
})
export class RedeemPage implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private toast = inject(ToastController);

  token = '';
  state: 'ready' | 'loading' | 'success' | 'error' = 'ready';
  loading = false;
  ack = false;

  secret: string | null = null;
  itemId: string | null = null;
  errorMessage = 'Ce lien a peut-être déjà été utilisé, supprimé ou a expiré.';

  constructor() {
    addIcons({lockClosedOutline, copyOutline});
  }

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  async reveal() {
    if (!this.token) {
      this.state = 'error';
      return;
    }
    this.loading = true;
    this.state = 'loading';
    try {
      const url = `${environment.apiBaseUrl}/api/vaultlink/links/${encodeURIComponent(this.token)}/redeem`;
      const res = await this.http.get<RedeemResponse>(url, {withCredentials: false}).toPromise();

      const anyRes = res as any;
      // si la requête a réussi
      if ((anyRes?.secret && typeof anyRes.secret === 'string')) {
        this.secret = anyRes.secret;
        this.itemId = typeof anyRes.item_id === 'string' ? anyRes.item_id : null;
        this.state = 'success';
      } else {
        // échec
        const msg = (anyRes?.error?.message) || undefined;
        this.fail(msg);
      }
    } catch (e: any) {
      // Mapping simple des codes HTTP
      const status = e?.status;
      const msg =
        status === 404 ? 'Lien introuvable.' :
          status === 410 ? 'Lien déjà utilisé ou expiré.' :
            status === 429 ? 'Trop de tentatives. Réessayez dans un instant.' :
              e?.error?.error?.message || 'Impossible de révéler le secret.';
      this.fail(msg);
    } finally {
      this.loading = false;
    }
  }

  async copy() {
    if (!this.secret) return;
    await navigator.clipboard.writeText(this.secret);
    await (await this.toast.create({
      message: 'Copié dans le presse papier',
      duration: 1200,
      position: 'bottom'
    })).present();
  }

  private fail(msg?: string) {
    if (msg) this.errorMessage = msg;
    this.state = 'error';
  }
}
