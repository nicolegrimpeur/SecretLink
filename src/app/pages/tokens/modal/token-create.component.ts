import { Component, inject } from '@angular/core';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PatService} from "../../../shared/services/pat";
import {
  IonButton,
  IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonCheckbox,
  IonContent, IonFooter,
  IonHeader,
  IonInput,
  IonItem, IonLabel, IonList, IonListHeader, IonText,
  IonTitle,
  IonToolbar
} from "@ionic/angular/standalone";

type Scope = { key: string; label: string; help: string };

@Component({
  selector: 'app-token-create',
  templateUrl: './token-create.component.html',
  styleUrls: ['./token-create.component.scss'],
  imports: [
    IonToolbar,
    IonHeader,
    IonButtons,
    IonTitle,
    IonButton,
    IonContent,
    ReactiveFormsModule,
    IonItem,
    IonInput,
    IonList,
    IonListHeader,
    IonCheckbox,
    IonLabel,
    IonCard,
    IonCardHeader,
    IonCardContent,
    IonText,
    IonCardTitle,
    IonFooter
  ]
})
export class TokenCreateComponent {

  private fb = inject(FormBuilder);
  private api = inject(PatService);
  private modal = inject(ModalController);
  private toast = inject(ToastController);

  loading = false;
  createdToken: string | null = null;


  scopes: Scope[] = [
    { key: 'links:read',   label: 'Lire le statut des liens', help: 'Listing / export CSV' },
    { key: 'links:write',  label: 'Créer des liens', help: 'Bulk import via script' },
    { key: 'links:delete', label: 'Supprimer des liens', help: 'Révocation / purge' },
  ];

  form = this.fb.group({
    label: [''],
    scopes: [[this.scopes[0].key, this.scopes[1].key] as string[]], // défaut: read+write
  });

  toggleScope(key: string, checked: boolean) {
    const current = new Set(this.form.value.scopes || []);
    checked ? current.add(key) : current.delete(key);
    this.form.patchValue({ scopes: [...current] });
  }

  async submit() {
    this.loading = true;
    try {
      const { label, scopes } = this.form.value as any;
      const res = await this.api.create(label || null, scopes && scopes.length ? scopes : ['links:read','links:write']);
      this.createdToken = res.token; // one-time
      await this.toastMsg('Token généré');
    } catch (e: any) {
      await this.toastMsg(e?.error?.error?.message || 'Création échouée');
    } finally { this.loading = false; }
  }

  async copy() {
    if (!this.createdToken) return;
    await navigator.clipboard.writeText(this.createdToken);
    this.toastMsg('Copié dans le presse-papier').then();
  }

  close(){ this.modal.dismiss().then(); }
  done(){ this.modal.dismiss(null, 'created').then(); }

  private async toastMsg(message: string) {
    const t = await this.toast.create({ message, duration: 1400, position: 'bottom' });
    t.present().then();
  }

}
