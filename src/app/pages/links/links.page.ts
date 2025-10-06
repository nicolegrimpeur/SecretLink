import {Component, inject, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonTextarea
} from '@ionic/angular/standalone';
import {LinksService} from "../../shared/services/links";
import {ToastController} from "@ionic/angular";
import {LinkCreateItem, LinkCreateResult} from "../../shared/models/link-create";
import {LinkStatus} from "../../shared/models/link-status";

@Component({
  selector: 'app-links',
  templateUrl: './links.page.html',
  styleUrls: ['./links.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonButton, IonInput, IonLabel, IonItem, IonList, IonButtons, IonNote, IonTextarea, IonListHeader, ReactiveFormsModule, IonSegmentButton, IonSegment]
})
export class LinksPage implements OnInit {
  private api = inject(LinksService);
  private toast = inject(ToastController);

  tab: 'create' | 'status' = 'create';
  loading = false;

  // single
  form = inject(FormBuilder).group({
    item_id: ['', [Validators.required]],
    secret: ['', [Validators.required]],
    ttl_days: [7, []],
  });
  inlinePat: string = '';
  lastResults: LinkCreateResult[] | null = null;

  // bulk
  csvText = '';
  inlinePatBulk = '';
  idempotencyKey = '';
  todayKey = Date.now();

  // status
  since = '';
  until = '';
  inlinePatStatus = '';
  rows: LinkStatus[] = [];

  ngOnInit(){ this.reload().then(); }

  async createSingle() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const payload: LinkCreateItem[] = [{
        item_id: this.form.value.item_id!,
        secret: this.form.value.secret!,
        ttl_days: Number(this.form.value.ttl_days || 7),
      }];
      this.lastResults = await this.api.createBulk(payload, { pat: this.inlinePat || undefined });
      if (this.lastResults?.length) await this.reload();
    } catch (e: any) {
      this.toastMsg(e?.error?.error?.message || 'Création échouée').then();
    } finally { this.loading = false; }
  }

  async createBulk() {
    const items = this.parseCsv(this.csvText);
    if (!items.length) { this.toastMsg('CSV vide ou invalide'); return; }
    this.loading = true;
    try {
      this.lastResults = await this.api.createBulk(items, {
        pat: this.inlinePatBulk || undefined,
        idempotencyKey: this.idempotencyKey || undefined
      });
      if (this.lastResults?.length) await this.reload();
    } catch (e: any) {
      this.toastMsg(e?.error?.error?.message || 'Bulk échoué').then();
    } finally { this.loading = false; }
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
      items.push({ item_id, secret, ttl_days: Number.isFinite(ttl) ? ttl : 7 });
    }
    return items;
  }

  async reload() {
    try {
      this.rows = await this.api.listStatus(
        { since: this.since || undefined, until: this.until || undefined },
        { pat: this.inlinePatStatus || undefined }
      );
    } catch (e: any) {
      // ignore 401 ici si pas connecté
    }
  }

  linkUrl(token: string) {
    return `${location.origin}/api/vaultlink/links/${encodeURIComponent(token)}/redeem`;
  }

  async delete(token: string) {
    try {
      await this.api.deleteLink(token, { pat: this.inlinePatStatus || undefined });
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
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'links_status.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async toastMsg(message: string) {
    const t = await this.toast.create({ message, duration: 1400, position: 'bottom' });
    await t.present();
  }
}
