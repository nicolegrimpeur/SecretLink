import {bootstrapApplication} from '@angular/platform-browser';
import {PreloadAllModules, provideRouter, RouteReuseStrategy, TitleStrategy, withPreloading} from '@angular/router';
import {IonicRouteStrategy, provideIonicAngular} from '@ionic/angular';
import {provideHttpClient, withInterceptors, withXhr} from '@angular/common/http';
import {inject, LOCALE_ID, provideAppInitializer, provideZonelessChangeDetection} from "@angular/core";
import {registerLocaleData} from "@angular/common";
import localFr from '@angular/common/locales/fr';

import {routes} from './app/app.routes';
import {AppComponent} from './app/app.component';
import {AuthService} from "./app/core/auth";
import {sessionExpiredInterceptor} from "./app/shared/session-expired.interceptor";
import {PageMetaStrategy} from "./app/shared/services/page-meta";

registerLocaleData(localFr, 'fr');
bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    {provide: RouteReuseStrategy, useClass: IonicRouteStrategy},
    {provide: LOCALE_ID, useValue: 'fr'},
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    {provide: TitleStrategy, useClass: PageMetaStrategy},
    provideHttpClient(withXhr(), withInterceptors([sessionExpiredInterceptor])),
    provideAppInitializer(() => inject(AuthService).me().catch(() => null))
  ],
}).then().catch(err => console.error(err));
