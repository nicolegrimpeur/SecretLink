import {bootstrapApplication} from '@angular/platform-browser';
import {RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules} from '@angular/router';
import {IonicRouteStrategy, provideIonicAngular} from '@ionic/angular/standalone';
import {provideHttpClient, withInterceptors} from '@angular/common/http';

import {routes} from './app/app.routes';
import {AppComponent} from './app/app.component';
import {inject, provideAppInitializer} from "@angular/core";
import {AuthService} from "./app/shared/services/auth";
import {authInterceptor} from "./app/shared/auth.interceptor";

bootstrapApplication(AppComponent, {
  providers: [
    {provide: RouteReuseStrategy, useClass: IonicRouteStrategy},
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => inject(AuthService).me().catch(() => null))
  ],
}).then().catch(err => console.error(err));
