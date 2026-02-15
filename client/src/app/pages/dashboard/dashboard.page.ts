import {Component, computed, inject, signal} from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonRow,
  IonSkeletonText
} from '@ionic/angular/standalone';

import {RouterLink} from '@angular/router';
import {environment} from "../../../environments/environment";
import {LinkStatus} from "../../shared/models/link-status";
import {PAT} from "../../shared/models/pat";
import {StatusFilter} from "../../shared/models/statutsFilter";
import {addIcons} from 'ionicons';

import {
  addOutline,
  keyOutline,
  linkOutline,
  refreshOutline,
  statsChartOutline,
  trashBinOutline,
  trashOutline
} from 'ionicons/icons';
import {LinksService} from "../../core/links";
import {PatService} from "../../core/pat";


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [RouterLink, IonContent, IonRefresher, IonRefresherContent, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonIcon, IonSkeletonText]
})
export class DashboardPage {
  private linksService = inject(LinksService);
  private tokenService = inject(PatService);
  api = environment.apiBaseUrl;

  loading = signal(true);
  links = signal<LinkStatus[]>([]);
  tokens = signal<PAT[]>([]);

  constructor() {
    addIcons({ statsChartOutline, linkOutline, keyOutline, refreshOutline, addOutline, trashOutline, trashBinOutline });
  }

  async ionViewWillEnter() {
    await this.reload();
  }

  async reload(event?: CustomEvent) {
    this.loading.set(true);
    try {
      const [links, tokens] = await Promise.all([
        this.linksService.listStatus(),
        this.tokenService.list(),
      ]);
      this.links.set(links ?? []);
      this.tokens.set(tokens ?? []);
    } finally {
      this.loading.set(false);
      if (event) await (event.target as HTMLIonRefresherElement).complete();
    }
  }

  statusOf(row: LinkStatus): StatusFilter {
    const now = Date.now();
    if (row.deleted_at) return 'deleted';
    if (row.used_at) return 'used';
    if (row.expires_at && new Date(row.expires_at).getTime() <= now) return 'expired';
    return 'active';
  }

  countActive   = computed(() => this.links().filter(r => this.statusOf(r) === 'active').length);
  countUsed     = computed(() => this.links().filter(r => this.statusOf(r) === 'used').length);
  countDeleted  = computed(() => this.links().filter(r => this.statusOf(r) === 'deleted').length);
  countExpired  = computed(() => this.links().filter(r => this.statusOf(r) === 'expired').length);
  countActiveTokens   = computed(() => this.tokens().filter(t => !t?.revoked_at).length);
  countDeletedTokens   = computed(() => this.tokens().filter(t => t?.revoked_at).length);
}
