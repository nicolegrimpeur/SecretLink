import {Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, FormBuilder, Validators, ReactiveFormsModule} from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem, IonLabel,
  IonText,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import {Router, RouterLink} from '@angular/router';
import {AuthService} from "../../../shared/services/auth";

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, ReactiveFormsModule, IonItem, IonInput, IonButton, IonText, IonLabel, RouterLink]
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = false;
  error: string | null = null;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  async submit() {
    if (this.form.invalid) return;
    this.loading = true; this.error = null;
    try {
      const { email, password } = this.form.value as any;
      await this.auth.login(email, password);
      await this.router.navigateByUrl('/dashboard');
    } catch (e: any) {
      console.error(e);
      this.error = e?.error?.error?.message || 'Login failed';
    } finally {
      this.loading = false;
    }
  }
}

