import { Injectable } from '@angular/core';
import packageJson from '../../../package.json';

@Injectable({
  providedIn: 'root'
})
export class AppVersionService {
  public readonly version: any = packageJson.version;
}
