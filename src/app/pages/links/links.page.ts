import {Component, computed, ElementRef, inject, signal, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPopover,
  IonRow,
  IonSegment,
  IonSegmentButton,
  IonTextarea
} from '@ionic/angular/standalone';
import {LinksService} from "../../core/links";
import {SegmentValue} from "@ionic/angular";
import {LinkCreateItem, LinkCreateResult} from "../../shared/models/link-create";
import {LinkStatus} from "../../shared/models/link-status";
import {StatusFilter} from "../../shared/models/statutsFilter";
import {copyOutline, informationOutline, syncOutline, trashOutline} from "ionicons/icons";
import {addIcons} from "ionicons";
import {environment} from "../../../environments/environment";
import {Storage} from "../../core/storage";
import {ToastService} from "../../shared/toast-service";
import {ActivatedRoute} from "@angular/router";


@Component({
  selector: 'app-links',
  templateUrl: './links.page.html',
  styleUrls: ['./links.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonButton, IonInput, IonLabel, IonItem, IonList, IonButtons, IonNote, IonTextarea, IonListHeader, ReactiveFormsModule, IonSegmentButton, IonSegment, IonIcon, IonPopover, IonBadge, IonCol, IonGrid, IonRow, IonCheckbox]
})
export class LinksPage {
  @ViewChild(IonContent, { read: ElementRef }) contentEl!: ElementRef;
  private route = inject(ActivatedRoute);
  private api = inject(LinksService);
  private storage = inject(Storage);
  private toast = inject(ToastService);
  private alert = inject(AlertController);

  tab: 'create' | 'status' = 'create';
  loading = false;

  // single
  form = inject(FormBuilder).group({
    item_id: ['', [Validators.required]],
    secret: ['', [Validators.required]],
    ttl_days: [7, []],
  });
  lastResults: LinkCreateResult[] | null = null;

  // bulk
  showBulk: boolean = false;
  csvText = '';
  idempotencyKey = '';

  // status
  since = '';
  until = '';
  rows = signal<LinkStatus[]>([]);
  statusHelp: { [key: string]: string } = {
    'created': 'Lien créé avec succès.',
    'duplicate_item_id': 'Un lien avec le même identifiant existe déjà. Aucun nouveau lien n\'a été créé.',
    'invalid_item_id': 'Les informations fournies sont invalides. Veuillez les vérifier et réessayer.',
  }

  // filtres
  statusFilter = signal<StatusFilter | 'all'>('active');
  statusSearch: string = '';
  // Signal pour forcer l'actualisation des liens filtrés
  private refreshTrigger = signal(0);

  // compteurs
  countActive = computed(() => this.rows().filter(r => this.statusOf(r) === 'active').length);
  countUsed = computed(() => this.rows().filter(r => this.statusOf(r) === 'used').length);
  countDeleted = computed(() => this.rows().filter(r => this.statusOf(r) === 'deleted').length);
  countExpired = computed(() => this.rows().filter(r => this.statusOf(r) === 'expired').length);

  constructor() {
    addIcons({syncOutline, informationOutline, copyOutline, trashOutline});
  }

  async ionViewWillEnter() {
    if (this.route.snapshot.queryParamMap.get('tab') === 'status') {
      this.tab = 'status';
    }

    this.idempotencyKey = await this.storage.get('links_idempotencyKey') || '';
    this.statusFilter.set(await this.storage.get('links_statusFilter') || 'active');
    this.reload().then();
  }

  async createSingle() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const payload: LinkCreateItem[] = [{
        item_id: this.form.value.item_id!,
        secret: this.form.value.secret!,
        ttl_days: Number(this.form.value.ttl_days || 0),
      }];
      this.lastResults = await this.api.createBulk(payload);
      if (this.lastResults?.length) await this.reload();
    } catch (e: any) {
      this.toast.toastMsg(e?.error?.error?.message || 'Création échouée').then();
    } finally {
      this.loading = false;
    }
  }

  private async generateIdempotencyKey(items: LinkCreateItem[]): Promise<string> {
    console.log(items);
    const itemsString = JSON.stringify(items.map(item => ({
      item_id: item.item_id,
      secret: item.secret,
      ttl_days: item.ttl_days
    })).sort((a, b) => a.item_id.localeCompare(b.item_id)));

    const encoder = new TextEncoder();
    const data = encoder.encode(itemsString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `bulk-${hashHex.substring(0, 12)}`;
  }

  async createBulk() {
    const items = this.parseCsv(this.csvText);
    if (!items.length) {
      this.toast.toastMsg('CSV vide ou invalide').then();
      return;
    }
    this.loading = true;
    try {
      this.lastResults = await this.api.createBulk(items, {
        idempotencyKey: await this.generateIdempotencyKey(items)
      });
      if (this.lastResults?.length) await this.reload();
    } catch (e: any) {
      this.toast.toastMsg(e?.error?.error?.message || 'Bulk échoué').then();
    } finally {
      this.loading = false;
    }
  }

  parseCsv(text: string): LinkCreateItem[] {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    let start = 0;
    const items: LinkCreateItem[] = [];

    // detect header
    const first = lines[0].toLowerCase();
    const hasHeader = ['item_id,secret', 'item_id;secret'].some(h => first.startsWith(h));
    if (hasHeader) start = 1;

    for (let i = start; i < lines.length; i++) {
      const sep = lines[i].includes(';') ? ';' : ',';
      const parts = lines[i].split(sep).map(s => s.trim());
      if (parts.length < 2) continue;
      const [item_id, secret, ttlStr] = parts;
      const ttl = ttlStr ? Number(ttlStr) : 0;
      if (!item_id || !secret) continue;
      items.push({item_id, secret, ttl_days: Number.isFinite(ttl) ? ttl : 7});
    }
    return items;
  }

  async reload() {
    try {
      this.rows.set(await this.api.listStatus(
        {since: this.since || undefined, until: this.until || undefined}
      ));
      this.forceRefresh();
    } catch (e: any) {
      // ignore 401 ici si pas connecté
    }
  }

  linkUrl(token: string) {
    return `${environment.frontBaseUrl}/redeem?token=${encodeURIComponent(token)}`;
  }

  askBeforeDelete(token: string) {
    this.alert.create({
      header: 'Supprimer ce lien ?',
      message: `Cette action est irréversible.`,
      buttons: [
        {text: 'Annuler', role: 'cancel'},
        {text: 'Supprimer', role: 'destructive', handler: () => this.delete(token)}
      ]
    }).then(a => a.present());
  }

  private async delete(token: string) {
    try {
      await this.api.deleteLink(token);
      await this.reload();
    } catch (e: any) {
      this.toast.toastMsg(e?.error?.error?.message || 'Suppression échouée').then();
    }
  }

  copy(text: string) {
    navigator.clipboard.writeText(text)
      .then(() => this.toast.toastMsg('Copié dans le presse-papier').then())
      .catch(() => this.toast.toastMsg('Échec de la copie dans le presse-papier').then());
  }

  exportCsv() {
    const header = 'item_id;link_token;created_at;expires_at;used_at;deleted_at';
    const lines = this.rows().map(r => [
      r.item_id, r.link_token, r.created_at, r.expires_at ?? '', r.used_at ?? '', r.deleted_at ?? ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    const blob = new Blob([header + '\n' + lines.join('\n')], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'links_status.csv';
    a.click();
    URL.revokeObjectURL(url);
  }


  /////////// Status ///////////
  statusOf(row: LinkStatus): StatusFilter {
    const now = Date.now();
    if (row.deleted_at) return 'deleted';
    if (row.used_at) return 'used';
    if (row.expires_at && new Date(row.expires_at).getTime() < now) return 'expired';
    return 'active';
  }

  setStatusFilter(v: SegmentValue) {
    const sf = v as StatusFilter | 'all';

    this.statusFilter.set(sf);
    this.storage.set('links_statusFilter', sf).then();
  }

  isLinkExpired(row: LinkStatus): boolean {
    if (row.expires_at) {
      const expTime = new Date(row.expires_at).getTime();
      return expTime < Date.now();
    } else {
      return false;
    }
  }

  forceRefresh() {
    this.refreshTrigger.set(this.refreshTrigger() + 1);
  }

  filteredRows = computed(() => {
    // Dépendance au trigger pour forcer le recalcul
    this.refreshTrigger();

    const q = this.statusSearch.toLowerCase();
    const f = this.statusFilter();

    return this.rows().filter(r => {
      // filtre statut
      const st = this.statusOf(r);
      if (f !== 'all' && st !== f) return false;

      // filtre texte
      if (q) {
        const hay = `${r.item_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });
  protected readonly Number = Number;
}
