import { expect, test } from '@playwright/test';
import { seedPassphraseLink, seedPublicLink } from '../helpers/api.js';

/**
 * La promesse produit de SecretLink : un lien s'ouvre une fois, puis meurt.
 *
 * Les liens sont créés par l'API, et seul le parcours navigateur est joué ici.
 * C'est délibéré : les 98 tests d'intégration couvrent déjà le comportement de
 * l'API sous tous ses codes de retour. Ce qu'eux ne peuvent pas prouver, c'est
 * qu'un humain avec un navigateur voit le secret puis se heurte à un mur.
 */

/** La page n'appelle l'API qu'au clic : ouvrir l'URL ne consomme rien. */
async function revealSecret(page: import('@playwright/test').Page) {
  await expect(page.getByText('Ce lien est à usage unique')).toBeVisible();

  // La case d'acquittement conditionne le bouton.
  await page.locator('#checkbox-ack').click();
  await page.getByRole('button', { name: 'Afficher le secret' }).click();
}

test.describe('redeem - lien à usage unique', () => {
  test('affiche le secret, puis refuse toute réouverture', async ({ page, request }) => {
    const secret = 'vpn-ALICE-e2e-vwxyz';
    const { linkUrl } = await seedPublicLink(request, secret);

    await page.goto(linkUrl);
    await revealSecret(page);

    await expect(page.getByText('Secret révélé')).toBeVisible();
    // Le secret est rendu dans un ion-textarea en lecture seule.
    await expect(page.locator('ion-textarea textarea')).toHaveValue(secret);

    // Réouverture du même lien. La page repart en état « ready » : elle
    // n'interroge l'API qu'au clic, donc l'écran d'acquittement s'affiche
    // encore et le lien ne révèle sa mort qu'après tentative.
    await page.goto(linkUrl);
    await revealSecret(page);

    await expect(page.getByText('Lien invalide ou expiré')).toBeVisible();
    await expect(page.getByText('Lien déjà utilisé ou expiré.')).toBeVisible();
    await expect(page.getByText('Secret révélé')).toHaveCount(0);
  });

  test('ouvrir la page sans révéler ne consomme PAS le lien', async ({ page, request }) => {
    const secret = 'toujours-la-apres-visite';
    const { linkUrl } = await seedPublicLink(request, secret);

    // Première visite : on regarde, on ne clique pas.
    await page.goto(linkUrl);
    await expect(page.getByText('Ce lien est à usage unique')).toBeVisible();

    // Seconde visite, cette fois on révèle : le secret doit être intact.
    await page.goto(linkUrl);
    await revealSecret(page);

    await expect(page.locator('ion-textarea textarea')).toHaveValue(secret);
  });

  test('affiche « lien invalide » sur un token inconnu', async ({ page }) => {
    await page.goto('/redeem/token-qui-nexiste-pas');
    await revealSecret(page);

    await expect(page.getByText('Lien invalide ou expiré')).toBeVisible();
    await expect(page.getByText('Lien introuvable.')).toBeVisible();
  });
});

test.describe('redeem - lien protégé par passphrase', () => {
  const PASSPHRASE = 'ouvre-toi-sesame';

  test('exige la passphrase, refuse la mauvaise, accepte la bonne', async ({ page, request }) => {
    const secret = 'secret-sous-passphrase';
    const { linkUrl } = await seedPassphraseLink(request, secret, PASSPHRASE);

    await page.goto(linkUrl);
    await revealSecret(page);

    // Le serveur a répondu 403 PASSPHRASE_REQUIRED : le formulaire apparaît.
    await expect(page.getByText('Passphrase requise')).toBeVisible();

    // Mauvaise passphrase : message d'erreur, et le lien reste vivant.
    await page.getByLabel('Passphrase :').fill('mauvaise-passphrase');
    await page.getByRole('button', { name: 'Afficher le secret' }).click();
    await expect(page.getByText('La passphrase est incorrecte. Veuillez réessayer.')).toBeVisible();

    // Bonne passphrase : le secret s'affiche.
    await page.getByLabel('Passphrase :').fill(PASSPHRASE);
    await page.getByRole('button', { name: 'Afficher le secret' }).click();

    await expect(page.getByText('Secret révélé')).toBeVisible();
    await expect(page.locator('ion-textarea textarea')).toHaveValue(secret);
  });
});
