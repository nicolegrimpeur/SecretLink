import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  ValidatorFn
} from '@angular/forms';
import {
  IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonContent, IonIcon, IonInput, IonInputPasswordToggle,
  IonItem, IonLabel, IonText, IonSegment, IonSegmentButton
} from '@ionic/angular/standalone';
import { AuthService} from "../../shared/services/auth";
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { lockClosedOutline, personAddOutline } from 'ionicons/icons';
import { SegmentValue} from "@ionic/angular";

type Mode = 'login' | 'signup';

@Component({
  selector: 'app-auth',
  standalone: true,
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonContent,
    IonItem, IonInput, IonButton, IonText, IonLabel,
    IonInputPasswordToggle, IonCardHeader, IonCard, IonCardTitle, IonCardContent,
    IonIcon, IonSegment, IonSegmentButton
  ]
})
export class AuthPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  mode = signal<Mode>('login');
  loading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    passwordConfirm: ['', []],
  });

  private passwordMatchValidator: ValidatorFn = (group) => {
    const pass = group.get('password')?.value;
    const confirm = group.get('passwordConfirm')?.value;
    return pass && confirm && pass !== confirm ? { passwordMismatch: true } : null;
  };

  constructor() {
    addIcons({ lockClosedOutline, personAddOutline });

    effect(() => {
      const m = this.mode();

      const passwordConfirmForm = this.form.get('passwordConfirm')!;
      if (m === 'signup') {
        // active le champ + validators
        passwordConfirmForm.enable({ emitEvent: false });
        passwordConfirmForm.addValidators(Validators.required);
        this.form.setValidators(this.passwordMatchValidator);
      } else {
        // désactive le champ + enlève ses validators et sa valeur
        passwordConfirmForm.clearValidators();
        passwordConfirmForm.setValue(null, { emitEvent: false });
        passwordConfirmForm.disable({ emitEvent: false });
        this.form.clearValidators();
      }

      passwordConfirmForm.updateValueAndValidity({ emitEvent: false });
      this.form.updateValueAndValidity({ emitEvent: false });
    });
  }

  switchMode(m: Mode | SegmentValue) {
    if (m !== this.mode()) {
      this.mode.set(m as Mode);
    }
  }

  title = computed(() => this.mode() === 'login' ? "Se connecter" : "Créer un compte");
  icon  = computed(() => this.mode() === 'login' ? 'lock-closed-outline' : 'person-add-outline');
  submitLabel = computed(() => this.mode() === 'login' ? "Se connecter" : "Créer un compte");
  altQuestion = computed(() => this.mode() === 'login' ? "Pas de compte ?" : "Déjà un compte ?");
  altActionLabel = computed(() => this.mode() === 'login' ? "Créer un compte" : "Se connecter");
  altTarget = computed<Mode>(() => this.mode() === 'login' ? 'signup' : 'login');

  async submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.value as any;

    try {
      if (this.mode() === 'login') {
        await this.auth.login(email, password);
      } else {
        await this.auth.signup(email, password);
      }
      await this.router.navigateByUrl('/dashboard');
    } catch (e: any) {
      console.error(e);
      this.error.set(e?.error?.error?.message || 'Action failed');
    } finally {
      this.loading.set(false);
    }
  }
}
