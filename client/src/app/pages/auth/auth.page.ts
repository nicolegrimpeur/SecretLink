import {Component, computed, effect, inject, signal} from '@angular/core';

import {FormBuilder, FormsModule, ReactiveFormsModule, ValidatorFn, Validators} from '@angular/forms';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonContent,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonText,
  ModalController,
} from '@ionic/angular/standalone';
import {AuthService} from "../../core/auth";
import {Router, RouterLink} from '@angular/router';
import {addIcons} from 'ionicons';
import {lockClosedOutline, personAddOutline} from 'ionicons/icons';
import {SegmentValue} from "@ionic/angular";
import {MfaSetupComponent} from './modal/mfa-setup.component';
import {MfaVerifyComponent} from './modal/mfa-verify.component';

type Mode = 'login' | 'signup';

@Component({
  selector: 'app-auth',
  standalone: true,
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonText,
    IonLabel,
    IonInputPasswordToggle,
    IonCardHeader,
    IonCard,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonCheckbox,
    RouterLink,
]
})
export class AuthPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private modalController = inject(ModalController);

  mode = signal<Mode>('login');
  loading = signal(false);
  error = signal<string | null>(null);
  submitted = signal(false);

  title = computed(() => this.mode() === 'login' ? "Se connecter" : "Créer un compte");
  icon  = computed(() => this.mode() === 'login' ? 'lock-closed-outline' : 'person-add-outline');
  submitLabel = computed(() => this.mode() === 'login' ? "Se connecter" : "Créer un compte");
  altQuestion = computed(() => this.mode() === 'login' ? "Pas de compte ?" : "Déjà un compte ?");
  altActionLabel = computed(() => this.mode() === 'login' ? "Créer un compte" : "Se connecter");
  altTarget = computed<Mode>(() => this.mode() === 'login' ? 'signup' : 'login');

  backendError = [
    { code: 'UNAUTHORIZED', message: "Mot de passe incorrect." },
    { code: 'VALIDATION_ERROR', message: "Une erreur a eu lieu, vérifiez le format du mail." },
    { code: 'CONFLICT', message: "Un compte avec cet email existe déjà." },
    { code: 'PRE_AUTH_EXPIRED', message: "Session expirée. Veuillez vous reconnecter." },
    { code: 'RATE_LIMITED', message: "Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer." },
  ];

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    passwordConfirm: ['', []],
    termsAccepted: [false, []],
  });

  private passwordMatchValidator: ValidatorFn = (group) => {
    const passCtrl = group.get('password');
    const confirmCtrl = group.get('passwordConfirm');
    if (!passCtrl || !confirmCtrl || confirmCtrl.disabled) return null;

    const pass = passCtrl.value ?? '';
    const confirm = confirmCtrl.value ?? '';
    const mismatch = pass && confirm && pass !== confirm;

    if (mismatch) {
      confirmCtrl.setErrors({ ...(confirmCtrl.errors || {}), passwordMismatch: true });
    } else {
      if (confirmCtrl.hasError('passwordMismatch')) {
        const { passwordMismatch, ...rest } = confirmCtrl.errors || {};
        confirmCtrl.setErrors(Object.keys(rest).length ? rest : null);
      }
    }
    return mismatch ? { passwordMismatch: true } : null;
  };

  constructor() {
    addIcons({ lockClosedOutline, personAddOutline });

    effect(() => {
      const m = this.mode();
      this.submitted.set(false); // reset affichage erreurs quand on change d’onglet

      const passwordConfirmForm = this.form.get('passwordConfirm')!;
      const termsCtrl = this.form.get('termsAccepted')!;

      if (m === 'signup') {
        passwordConfirmForm.enable({ emitEvent: false });
        passwordConfirmForm.setValidators([Validators.required]);
        this.form.setValidators(this.passwordMatchValidator);

        termsCtrl.enable({ emitEvent: false });
        termsCtrl.setValidators([Validators.requiredTrue]);
      } else {
        passwordConfirmForm.setValue(null, { emitEvent: false });
        passwordConfirmForm.clearValidators();
        passwordConfirmForm.setErrors(null);
        passwordConfirmForm.disable({ emitEvent: false });

        termsCtrl.setValue(false, { emitEvent: false });
        termsCtrl.clearValidators();
        termsCtrl.setErrors(null);
        termsCtrl.disable({ emitEvent: false });

        this.form.clearValidators();
        this.form.setErrors(null);
      }

      passwordConfirmForm.updateValueAndValidity({ emitEvent: false });
      termsCtrl.updateValueAndValidity({ emitEvent: false });
      this.form.updateValueAndValidity({ emitEvent: false });
    });
  }


  switchMode(m: Mode | SegmentValue) {
    if (m !== this.mode()) {
      this.mode.set(m as Mode);
    }
  }

  private control(name: 'email' | 'password' | 'passwordConfirm') {
    return this.form.get(name)!;
  }

  isInvalid(name: 'email' | 'password' | 'passwordConfirm') {
    const c = this.control(name);
    return c.invalid && (c.touched || c.dirty || this.submitted());
  }

  errorFor(name: 'email' | 'password' | 'passwordConfirm'): string | null {
    const c = this.control(name);
    if (!this.isInvalid(name)) return null;

    const e = c.errors || {};
    if (e['required']) return 'Ce champ est requis.';
    if (e['email']) return 'Adresse email invalide.';
    if (e['minlength']) return `Au moins ${e['minlength'].requiredLength} caractères (actuel : ${e['minlength'].actualLength}).`;
    if (e['passwordMismatch']) return 'Les mots de passe ne correspondent pas.';
    return 'Valeur invalide.';
  }

  async submit() {
    this.submitted.set(true);
    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: true });

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.value as any;

    try {
      if (this.mode() === 'signup') {
        // Check email availability and generate MFA setup before opening modal
        let mfaSetup: { provisioning_uri: string; secret: string };
        try {
          mfaSetup = await this.auth.generateMfaSetup(email);
        } catch (e: any) {
          const code = e?.error?.error?.code || '';
          const known = this.backendError.find(x => x.code === code);
          this.error.set(known?.message ?? 'Une erreur est survenue.');
          return;
        }

        // Open MFA setup modal — signup happens inside the modal
        const modal = await this.modalController.create({
          component: MfaSetupComponent,
          componentProps: { email, password, provisioningUriInput: mfaSetup.provisioning_uri, secretInput: mfaSetup.secret },
          backdropDismiss: false,
        });
        await modal.present();
        const { data } = await modal.onWillDismiss();
        if (data?.success) {
          // Account created, redirect to login
          this.form.reset();
          this.error.set(null);
          this.switchMode('login');
        }
      } else {
        // Login step 1: email + password
        const result = await this.auth.login(email, password);

        if (!result.mfa_required) {
          // Trusted device — session already issued by service
          await this.router.navigateByUrl('/dashboard');
          this.form.reset();
        } else {
          // Open MFA verify modal
          const modal = await this.modalController.create({
            component: MfaVerifyComponent,
            componentProps: { preAuthToken: result.pre_auth_token },
            backdropDismiss: false,
          });
          await modal.present();
          const { data } = await modal.onWillDismiss();
          if (data?.success) {
            await this.router.navigateByUrl('/dashboard');
            this.form.reset();
          } else if (data?.expired) {
            this.error.set('Session expirée. Veuillez vous reconnecter.');
          }
        }
      }
    } catch (e: any) {
      const code = e?.error?.error?.code || e?.code || e?.message;
      const known = this.backendError.find(x => x.code === code);
      this.error.set(known?.message ?? 'Une erreur est survenue.');
    } finally {
      this.loading.set(false);
    }
  }

}
