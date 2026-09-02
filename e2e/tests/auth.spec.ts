import { expect, test, type Locator, type Page } from '@playwright/test';
import { totpNow } from '../helpers/api.js';

/**
 * Inscription et connexion jouées entièrement dans le navigateur.
 *
 * C'est le parcours qui mobilise le plus de mécanique que seul un vrai
 * navigateur exerce : deux modales Ionic, un secret TOTP lu à l'écran, un
 * cookie de session posé par l'API au travers du proxy nginx, et des gardes de
 * route Angular qui s'appuient dessus.
 *
 * ⚠️ Un seul compte est créé dans tout ce fichier. Le limiteur d'inscription est
 * à **5 par heure et par IP**, et derrière nginx tous les tests partagent la
 * même IP - la spoofer ne sert à rien, nginx réécrit toujours le dernier saut.
 * Voir e2e/README.md.
 */

const PASSWORD = 'correct-horse-battery-staple';

/**
 * Coche une case Ionic.
 *
 * Cliquer l'hôte `ion-checkbox` ne suffit pas : sur la case des conditions, le
 * libellé contient un lien « Politique de confidentialité » dont le handler
 * fait `stopPropagation()`. Un clic au centre atterrit dessus et n'atteint
 * jamais la case. On vise donc la boîte visuelle, ce qu'un humain clique.
 */
async function checkIonCheckbox(scope: Page | Locator, index = 0) {
  await scope.locator('ion-checkbox').nth(index).locator('.checkbox-icon').click();
}

/** Modale Ionic identifiée par son titre, pour ne pas viser la page derrière. */
const modalWithTitle = (page: Page, title: string) =>
  page.locator('ion-modal').filter({ hasText: title });

test.describe('inscription et connexion', () => {
  test('crée un compte avec MFA, puis se connecte et accède au dashboard', async ({ page }) => {
    const email = `e2e-ui-${Date.now()}@test.local`;

    // ─── Inscription ───────────────────────────────────────────────────────
    await page.goto('/auth');
    // Le segment-button capte le pointeur ; son ion-label interne, non.
    await page.locator('ion-segment-button[value="signup"]').click();

    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(PASSWORD);
    await checkIonCheckbox(page);

    const submit = page.getByRole('button', { name: 'Créer un compte' });
    await expect(submit, 'le formulaire doit être valide').toBeEnabled();
    await submit.click();

    // ─── Modale de configuration MFA ───────────────────────────────────────
    const setup = modalWithTitle(page, 'Configuration MFA');
    await expect(setup).toBeVisible();

    // Le secret est affiché en clair pour la saisie manuelle : c'est ce qui
    // permet au test de tenir le rôle de l'application authenticator.
    const secret = (await setup.locator('.secret-text').innerText()).trim();
    expect(secret.length).toBeGreaterThanOrEqual(16);

    await setup.getByLabel('Code OTP (6 chiffres)').fill(await totpNow(secret));
    await setup.getByRole('button', { name: 'Confirmer et créer le compte' }).click();

    // ─── Codes de récupération ─────────────────────────────────────────────
    await expect(page.getByText('Compte créé !')).toBeVisible();
    await expect(setup.locator('.recovery-code')).toHaveCount(8);

    await checkIonCheckbox(setup);
    await setup.getByRole('button', { name: 'Terminer l\'inscription' }).click();

    // L'inscription n'ouvre PAS de session : on revient au formulaire.
    await expect(setup).toBeHidden();
    await expect(page).toHaveURL(/\/auth/);

    // ─── Connexion ─────────────────────────────────────────────────────────
    await page.locator('ion-segment-button[value="login"]').click();
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    const verify = modalWithTitle(page, 'Vérification MFA');
    await expect(verify).toBeVisible();
    await verify.getByLabel('Code OTP (6 chiffres)').fill(await totpNow(secret));
    await verify.getByRole('button', { name: 'Vérifier' }).click();

    // ─── Session active ────────────────────────────────────────────────────
    await expect(page).toHaveURL(/\/dashboard/);

    // La garde de route s'appuie sur le cookie posé par l'API via le proxy :
    // atteindre une page protégée par navigation directe le prouve.
    await page.goto('/account');
    await expect(page).toHaveURL(/\/account/);

    const sid = (await page.context().cookies()).find((c) => c.name === 'sid');
    expect(sid, 'le cookie de session doit être posé').toBeDefined();
    expect(sid!.httpOnly).toBe(true);
  });

  test('redirige vers /auth une page protégée atteinte sans session', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/auth/);
  });
});
