import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, firstValueFrom} from 'rxjs';
import {environment} from 'src/environments/environment';
import {User} from '../shared/models/user';

export interface MfaSetupData {
  provisioning_uri: string;
  secret: string;
}

export interface LoginResponse {
  mfa_required: boolean;
  pre_auth_token?: string;
  user?: User;
}

export interface SignupResult {
  user: User;
  recovery_codes: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private userSubject = new BehaviorSubject<User>(null);
  user$ = this.userSubject.asObservable();

  get user(): User { return this.userSubject.value; }

  async generateMfaSetup(email: string): Promise<MfaSetupData> {
    const url = `${environment.apiBaseUrl}/users/mfa/generate`;
    return firstValueFrom(this.http.post<MfaSetupData>(url, { email }));
  }

  async signup(email: string, password: string, totpSecret: string, totpCode: string): Promise<SignupResult> {
    const url = `${environment.apiBaseUrl}/users/signup`;
    return firstValueFrom(
      this.http.post<SignupResult>(url, { email, password, totp_secret: totpSecret, totp_code: totpCode })
    );
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const url = `${environment.apiBaseUrl}/users/login`;
    const result = await firstValueFrom(
      this.http.post<LoginResponse>(url, { email, password }, { withCredentials: true })
    );
    if (!result.mfa_required && result.user) {
      this.userSubject.next(result.user);
    }
    return result;
  }

  async verifyMfa(preAuthToken: string, totpCode?: string, recoveryCode?: string, rememberDevice = false): Promise<User> {
    const url = `${environment.apiBaseUrl}/users/mfa/verify`;
    const body: any = { pre_auth_token: preAuthToken, remember_device: rememberDevice };
    if (totpCode) body.totp_code = totpCode;
    if (recoveryCode) body.recovery_code = recoveryCode;
    const u = await firstValueFrom(this.http.post<User>(url, body, { withCredentials: true }));
    this.userSubject.next(u);
    return u;
  }

  async regenerateRecoveryCodes(): Promise<string[]> {
    const url = `${environment.apiBaseUrl}/users/mfa/recovery-codes`;
    const result = await firstValueFrom(
      this.http.post<{ recovery_codes: string[] }>(url, {}, { withCredentials: true })
    );
    return result.recovery_codes;
  }

  async me() {
    const url = `${environment.apiBaseUrl}/users/me`;
    const u = await firstValueFrom(this.http.get<User>(url, { withCredentials: true }));
    this.userSubject.next(u);
    return u;
  }

  async logout() {
    const url = `${environment.apiBaseUrl}/users/logout`;
    await firstValueFrom(this.http.post(url, {}, { withCredentials: true }));
    this.userSubject.next(null);
  }

  async changePassword(current_password: string, new_password: string) {
    const url = `${environment.apiBaseUrl}/users/password`;
    await firstValueFrom(this.http.post(url, { current_password, new_password }, { withCredentials: true }));
  }

  async purgeMe() {
    const url = `${environment.apiBaseUrl}/users/me/purge`;
    await firstValueFrom(this.http.delete(url, { withCredentials: true }));
  }

  async deleteMe() {
    const url = `${environment.apiBaseUrl}/users/me`;
    await firstValueFrom(this.http.delete(url, { withCredentials: true }));
    this.userSubject.next(null);
  }
}
