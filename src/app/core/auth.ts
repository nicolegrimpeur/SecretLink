import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, firstValueFrom} from 'rxjs';
import {environment} from 'src/environments/environment';
import {User} from '../shared/models/user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private userSubject = new BehaviorSubject<User>(null);
  user$ = this.userSubject.asObservable();

  get user(): User { return this.userSubject.value; }

  async signup(email: string, password: string) {
    const url = `${environment.apiBaseUrl}/secretLink/users/signup`;
    const u = await firstValueFrom(this.http.post<User>(url, { email, password }, { withCredentials: true }));
    this.userSubject.next(u);
    return u;
  }

  async login(email: string, password: string) {
    const url = `${environment.apiBaseUrl}/secretLink/users/login`;
    const u = await firstValueFrom(this.http.post<User>(url, { email, password }, { withCredentials: true }));
    this.userSubject.next(u);
    return u;
  }

  async me() {
    const url = `${environment.apiBaseUrl}/secretLink/users/me`;
    const u = await firstValueFrom(this.http.get<User>(url, { withCredentials: true }));
    this.userSubject.next(u);
    return u;
  }

  async logout() {
    const url = `${environment.apiBaseUrl}/secretLink/users/logout`;
    await firstValueFrom(this.http.post(url, {}));
    this.userSubject.next(null);
  }

  async changePassword(current_password: string, new_password: string) {
    const url = `${environment.apiBaseUrl}/secretLink/users/password`;
    await firstValueFrom(this.http.post(url, { current_password, new_password }, { withCredentials: true }));
  }

  async purgeMe() {
    const url = `${environment.apiBaseUrl}/secretLink/users/me/purge`;
    await firstValueFrom(this.http.delete(url, { withCredentials: true }));
  }

  async deleteMe() {
    const url = `${environment.apiBaseUrl}/secretLink/users/me`;
    await firstValueFrom(this.http.delete(url, { withCredentials: true }));
    this.userSubject.next(null);
  }
}
