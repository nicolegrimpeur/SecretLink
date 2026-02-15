import {Component, inject} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController
} from '@ionic/angular/standalone';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {PatService} from "../../../core/pat";
import {ToastService} from "../../../shared/services/toast";

type Scope = { key: string; label: string; help: string };

@Component({
  selector: 'app-token-create',
  templateUrl: './token-create.component.html',
  styleUrls: ['./token-create.component.scss'],
  standalone: true,
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
    IonCardTitle
  ]
})
export class TokenCreateComponent {

  private fb = inject(FormBuilder);
  private api = inject(PatService);
  private modalController = inject(ModalController);
  private toast = inject(ToastService);

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

  toggleScope(key: string) {
    const current = new Set(this.form.value.scopes || []);
    !current.has(key) ? current.add(key) : current.delete(key);
    this.form.patchValue({ scopes: [...current] });
  }

  async submit() {
    this.loading = true;
    try {
      const { label, scopes } = this.form.value as any;
      const res = await this.api.create(label || null, scopes && scopes.length ? scopes : ['links:read','links:write']);
      this.createdToken = res.token;
      await this.toast.toastMsg('Token généré');
    } catch (e: any) {
      await this.toast.toastMsg(e?.error?.error?.message || 'Création échouée');
    } finally { this.loading = false; }
  }

  async copy() {
    if (!this.createdToken) return;
    await navigator.clipboard.writeText(this.createdToken);
    this.toast.toastMsg('Copié dans le presse-papier').then();
  }

  close(){ this.modalController.dismiss().then(); }
  done(){ this.modalController.dismiss(null, 'created').then(); }
}
