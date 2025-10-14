import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent, IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote, IonPopover,
  IonSegment,
  IonSegmentButton,
  IonTextarea
} from '@ionic/angular/standalone';
import {LinksService} from "../../shared/services/links";
import {SegmentValue, ToastController} from "@ionic/angular";
import {LinkCreateItem, LinkCreateResult} from "../../shared/models/link-create";
import {LinkStatus} from "../../shared/models/link-status";
import {syncOutline, informationCircleOutline} from "ionicons/icons";
import {addIcons} from "ionicons";
import {environment} from "../../../environments/environment";
import {Storage} from "../../core/storage";

type StatusFilter = 'active' | 'used' | 'deleted' | 'expired';
@Component({
  selector: 'app-links',
  templateUrl: './links.page.html',
  styleUrls: ['./links.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonButton, IonInput, IonLabel, IonItem, IonList, IonButtons, IonNote, IonTextarea, IonListHeader, ReactiveFormsModule, IonSegmentButton, IonSegment, IonIcon, IonPopover, IonBadge]
})
export class LinksPage {
  private api = inject(LinksService);
  private toast = inject(ToastController);
  private storage = inject(Storage);

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
  csvText = '';
  inlinePatBulk = '';
  idempotencyKey = '';

  // status
  since = '';
  until = '';
  rows: LinkStatus[] = [];
  statusHelp: {[key: string]: string} = {
    'created': 'Lien créé avec succès.',
    'duplicate_item_id': 'Un lien avec le même identifiant existe déjà. Aucun nouveau lien n\'a été créé.',
    'invalid_item_id': 'Les informations fournies sont invalides. Veuillez les vérifier et réessayer.',
  }

  // filtres
  statusFilter = signal<StatusFilter | 'all'>('active');
  qLinks = signal<string>('');

  // compteurs
  countActive  = computed(() => this.rows.filter(r => this.statusOf(r) === 'active').length);
  countUsed    = computed(() => this.rows.filter(r => this.statusOf(r) === 'used').length);
  countDeleted = computed(() => this.rows.filter(r => this.statusOf(r) === 'deleted').length);
  countExpired = computed(() => this.rows.filter(r => this.statusOf(r) === 'expired').length);

  constructor() {
    addIcons({syncOutline, informationCircleOutline});
  }

  async ionViewWillEnter() {
    this.idempotencyKey = await this.storage.get('links_idempotencyKey') || '';
    this.statusFilter.set(await this.storage.get('links_statusFilter') || 'active');
    this.reload().then();
  }

  generateKey() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      '-',
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join('');
    this.idempotencyKey = `bulk-${ts}-${this.randSuffix(6)}`;
    this.persistKey();
  }

  // Petit suffixe random base36
  private randSuffix(len = 6) {
    return [...crypto.getRandomValues(new Uint8Array(len))]
      .map(b => (b % 36).toString(36))
      .join('');
  }

  private persistKey() {
    if (this.idempotencyKey) this.storage.set('links_idempotencyKey', this.idempotencyKey).then();
  }

  clearKey() {
    if (this.idempotencyKey === '') this.storage.delete('links_idempotencyKey').then();
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
      this.toastMsg(e?.error?.error?.message || 'Création échouée').then();
    } finally {
      this.loading = false;
    }
  }

  async createBulk() {
    const items = this.parseCsv(this.csvText);
    if (!items.length) {
      this.toastMsg('CSV vide ou invalide').then();
      return;
    }
    this.loading = true;
    try {
      this.lastResults = await this.api.createBulk(items, {
        pat: this.inlinePatBulk || undefined,
        idempotencyKey: this.idempotencyKey || undefined
      });
      if (this.lastResults?.length) await this.reload();
    } catch (e: any) {
      this.toastMsg(e?.error?.error?.message || 'Bulk échoué').then();
    } finally {
      this.loading = false;
    }
  }

  parseCsv(text: string): LinkCreateItem[] {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    let start = 0;
    const items: LinkCreateItem[] = [];

    // détecte header
    const first = lines[0].toLowerCase();
    const hasHeader = ['item_id,secret', 'item_id;secret'].some(h => first.startsWith(h));
    if (hasHeader) start = 1;

    for (let i = start; i < lines.length; i++) {
      const sep = lines[i].includes(';') ? ';' : ',';
      const parts = lines[i].split(sep).map(s => s.trim());
      if (parts.length < 2) continue;
      const [item_id, secret, ttlStr] = parts;
      const ttl = ttlStr ? Number(ttlStr) : 7;
      if (!item_id || !secret) continue;
      items.push({item_id, secret, ttl_days: Number.isFinite(ttl) ? ttl : 7});
    }
    return items;
  }

  async reload() {
    try {
      this.rows = await this.api.listStatus(
        {since: this.since || undefined, until: this.until || undefined}
      );
      // console.log(this.rows);
    } catch (e: any) {
      // ignore 401 ici si pas connecté
    }
  }

  linkUrl(token: string) {
    return `${environment.frontBaseUrl}/redeem/${encodeURIComponent(token)}`;
  }

  async delete(token: string) {
    try {
      await this.api.deleteLink(token);
      await this.reload();
    } catch (e: any) {
      this.toastMsg(e?.error?.error?.message || 'Suppression échouée').then();
    }
  }

  copy(text: string) {
    navigator.clipboard.writeText(text).then();
    this.toastMsg('Copié dans le presse-papier').then();
  }

  exportCsv() {
    const header = 'item_id,link_token,created_at,expires_at,used_at,deleted_at';
    const lines = this.rows.map(r => [
      r.item_id, r.link_token, r.created_at, r.expires_at ?? '', r.used_at ?? '', r.deleted_at ?? ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([header + '\n' + lines.join('\n')], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'links_status.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async toastMsg(message: string) {
    const t = await this.toast.create({message, duration: 1400, position: 'bottom'});
    await t.present();
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

  setQuery(v: string) {
    this.qLinks.set(v || '');
  }

  filteredRows = computed(() => {
    const q = this.qLinks().toLowerCase();
    const f = this.statusFilter();

    return this.rows.filter(r => {
      // filtre statut
      const st = this.statusOf(r);
      if (f !== 'all' && st !== f) return false;

      // filtre texte
      if (q) {
        const hay = `${r.item_id} ${r.link_token}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });
}
