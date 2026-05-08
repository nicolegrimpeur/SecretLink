import {Component, inject, Input, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import {AuthService} from '../../../core/auth';

@Component({
  selector: 'app-mfa-verify',
  templateUrl: './mfa-verify.component.html',
  styleUrls: ['./mfa-verify.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonItem,
    IonInput,
    IonText,
    IonSpinner,
    IonCheckbox,
    IonLabel,
  ],
})
export class MfaVerifyComponent {
  @Input() preAuthToken!: string;

  private auth = inject(AuthService);
  private modalController = inject(ModalController);

  submitting = signal(false);
  error = signal<string | null>(null);
  useRecovery = signal(false);

  otpCode = '';
  recoveryCode = '';
  rememberDevice = false;

  toggleMode() {
    this.useRecovery.update(v => !v);
    this.otpCode = '';
    this.recoveryCode = '';
    this.error.set(null);
  }

  private normalizeRecoveryCode(raw: string): string {
    return raw.trim().toUpperCase().replace(/-/g, '');
  }

  get isConfirmDisabled(): boolean {
    if (this.submitting()) return true;
    return this.useRecovery()
      ? this.normalizeRecoveryCode(this.recoveryCode).length === 0
      : this.otpCode.length !== 6;
  }

  async confirm() {
    this.submitting.set(true);
    this.error.set(null);

    try {
      if (this.useRecovery()) {
        await this.auth.verifyMfa(this.preAuthToken, undefined, this.normalizeRecoveryCode(this.recoveryCode), this.rememberDevice);
      } else {
        await this.auth.verifyMfa(this.preAuthToken, this.otpCode, undefined, this.rememberDevice);
      }
      this.modalController.dismiss({ success: true });
    } catch (e: any) {
      const code = e?.error?.error?.code || '';
      if (code === 'PRE_AUTH_EXPIRED') {
        this.modalController.dismiss({ expired: true });
      } else if (code === 'UNAUTHORIZED') {
        this.error.set(this.useRecovery()
          ? 'Code de récupération invalide ou déjà utilisé.'
          : 'Code MFA invalide.'
        );
      } else {
        this.error.set('Une erreur est survenue.');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  cancel() {
    this.modalController.dismiss({ success: false });
  }
}
