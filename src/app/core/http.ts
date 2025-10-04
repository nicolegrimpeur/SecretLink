import {inject, Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {environment} from "../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class Http {
  private baseUrl: string = environment.baseURI;
  private readonly http: HttpClient = inject(HttpClient);


}
