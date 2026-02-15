import {bootstrapApplication} from '@angular/platform-browser';
import {PreloadAllModules, provideRouter, RouteReuseStrategy, withPreloading} from '@angular/router';
import {IonicRouteStrategy, provideIonicAngular} from '@ionic/angular/standalone';
import {provideHttpClient} from '@angular/common/http';
import {inject, LOCALE_ID, provideAppInitializer, provideZoneChangeDetection} from "@angular/core";
import {registerLocaleData} from "@angular/common";
import localFr from '@angular/common/locales/fr';

import {routes} from './app/app.routes';
import {AppComponent} from './app/app.component';
import {AuthService} from "./app/core/auth";

registerLocaleData(localFr, 'fr');
bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),{provide: RouteReuseStrategy, useClass: IonicRouteStrategy},
    {provide: LOCALE_ID, useValue: 'fr'},
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(),
    provideAppInitializer(() => inject(AuthService).me().catch(() => null))
  ],
}).then().catch(err => console.error(err));
