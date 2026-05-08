import {Component, ElementRef, inject, Input, OnInit, signal, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import QRCode from 'qrcode';
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import {AuthService} from '../../../core/auth';
import {addIcons} from 'ionicons';
import {clipboardOutline, shieldCheckmarkOutline} from 'ionicons/icons';

@Component({
  selector: 'app-mfa-setup',
  templateUrl: './mfa-setup.component.html',
  styleUrls: ['./mfa-setup.component.scss'],
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
    IonList,
    IonLabel,
    IonCheckbox,
    IonIcon,
  ],
})
export class MfaSetupComponent implements OnInit {
  @Input() email!: string;
  @Input() password!: string;

  @ViewChild('qrCanvas', { static: false }) qrCanvasRef!: ElementRef<HTMLCanvasElement>;

  private auth = inject(AuthService);
  private modalController = inject(ModalController);

  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);

  secret = signal('');
  provisioningUri = signal('');
  otpCode = '';

  // Recovery codes step
  showRecoveryCodes = signal(false);
  recoveryCodes = signal<string[]>([]);
  savedConfirmed = false;

  constructor() {
    addIcons({ shieldCheckmarkOutline, clipboardOutline });
  }

  async ngOnInit() {
    try {
      const setup = await this.auth.generateMfaSetup(this.email);
      this.secret.set(setup.secret);
      this.provisioningUri.set(setup.provisioning_uri);
    } catch {
      this.error.set('Impossible de générer la configuration MFA.');
    } finally {
      this.loading.set(false);
    }
  }

  async ionViewDidEnter() {
    await this.renderQrCode();
  }

  // Fallback if ionViewDidEnter fires before canvas is ready
  async onQrContainerVisible() {
    if (this.provisioningUri()) {
      await this.renderQrCode();
    }
  }

  private async renderQrCode() {
    if (!this.qrCanvasRef?.nativeElement || !this.provisioningUri()) return;
    try {
      await QRCode.toCanvas(this.qrCanvasRef.nativeElement, this.provisioningUri(), {
        width: 220,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch { /* silent */ }
  }

  async confirm() {
    if (!this.otpCode || this.otpCode.length !== 6) {
      this.error.set('Entrez un code OTP à 6 chiffres.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    try {
      const result = await this.auth.signup(this.email, this.password, this.secret(), this.otpCode);
      this.recoveryCodes.set(result.recovery_codes);
      this.showRecoveryCodes.set(true);
    } catch (e: any) {
      const code = e?.error?.error?.code || '';
      if (code === 'VALIDATION_ERROR') {
        this.error.set(e?.error?.error?.message?.includes('MFA') ? 'Code MFA invalide.' : 'Données invalides.');
      } else if (code === 'CONFLICT') {
        this.error.set('Un compte avec cet email existe déjà.');
      } else {
        this.error.set('Une erreur est survenue.');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  async copyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(this.recoveryCodes().join('\n'));
    } catch { /* silent */ }
  }

  finish() {
    this.modalController.dismiss({ success: true });
  }

  cancel() {
    this.modalController.dismiss({ success: false });
  }
}
