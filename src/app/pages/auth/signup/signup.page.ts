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
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonButton, IonInput, IonItem, IonLabel, IonText, ReactiveFormsModule, RouterLink]
})
export class SignupPage {
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
      await this.auth.signup(email, password);
      await this.router.navigateByUrl('/dashboard');
    } catch (e: any) {
      this.error = e?.error?.error?.message || 'Login failed';
    } finally {
      this.loading = false;
    }
  }

}
