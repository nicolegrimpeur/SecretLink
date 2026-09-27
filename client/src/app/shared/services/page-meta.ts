import {inject, Injectable} from '@angular/core';
import {Meta, Title} from '@angular/platform-browser';
import {ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy} from '@angular/router';

const SITE_NAME = 'SecretLink';

/**
 * Titre et description de chaque page, lus dans les routes : `title` et
 * `data.description`. Sans valeur, on revient au titre et à la description
 * d'index.html.
 */
@Injectable({providedIn: 'root'})
export class PageMetaStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly defaultDescription = this.meta.getTag('name="description"')?.content ?? '';

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pageTitle = this.buildTitle(snapshot);
    const fullTitle = pageTitle ? `${pageTitle} - ${SITE_NAME}` : SITE_NAME;
    const description = this.deepestDescription(snapshot.root) ?? this.defaultDescription;

    this.title.setTitle(fullTitle);
    this.meta.updateTag({name: 'description', content: description});
    this.meta.updateTag({property: 'og:title', content: fullTitle});
    this.meta.updateTag({property: 'og:description', content: description});
  }

  private deepestDescription(route: ActivatedRouteSnapshot): string | undefined {
    let description: string | undefined;
    for (let r: ActivatedRouteSnapshot | null = route; r; r = r.firstChild) {
      description = r.data['description'] ?? description;
    }
    return description;
  }
}
