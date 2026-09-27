import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Meta, Title} from '@angular/platform-browser';
import {provideRouter, Router, TitleStrategy} from '@angular/router';

import {PageMetaStrategy} from './page-meta';

@Component({template: ''})
class DummyPage {}

describe('PageMetaStrategy', () => {
  let router: Router;
  let title: Title;
  let meta: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {path: '', component: DummyPage},
          {path: 'legal', title: 'Mentions légales', data: {description: 'Éditeur et hébergeur'}, component: DummyPage},
          {path: 'account', title: 'Mon compte', component: DummyPage},
        ]),
        {provide: TitleStrategy, useClass: PageMetaStrategy},
      ],
    });
    // Posée avant la création du routeur : la stratégie lit la valeur par défaut à sa construction
    meta = TestBed.inject(Meta);
    meta.updateTag({name: 'description', content: 'Description par défaut'});
    router = TestBed.inject(Router);
    title = TestBed.inject(Title);
  });

  it('suffixes the route title with the site name and applies its description', async () => {
    await router.navigateByUrl('/legal');

    expect(title.getTitle()).toBe('Mentions légales - SecretLink');
    expect(meta.getTag('name="description"')?.content).toBe('Éditeur et hébergeur');
    expect(meta.getTag('property="og:title"')?.content).toBe('Mentions légales - SecretLink');
  });

  it('falls back to the site name and the default description', async () => {
    await router.navigateByUrl('/legal');
    await router.navigateByUrl('/');

    expect(title.getTitle()).toBe('SecretLink');
    expect(meta.getTag('name="description"')?.content).toBe('Description par défaut');
  });

  it('keeps the default description on a titled route without one', async () => {
    await router.navigateByUrl('/account');

    expect(title.getTitle()).toBe('Mon compte - SecretLink');
    expect(meta.getTag('name="description"')?.content).toBe('Description par défaut');
  });
});
