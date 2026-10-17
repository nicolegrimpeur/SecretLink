import { expect, test } from '@playwright/test';

/**
 * Création anonyme depuis la page d'accueil, limitée à 64 caractères.
 *
 * Un attribut maxlength ferait tronquer silencieusement un collage trop long
 * par le navigateur : le lien partirait avec un secret amputé. Le dépassement
 * doit au contraire rester visible et bloquer la création.
 */
test.describe('accueil - création anonyme', () => {
  test('un secret trop long est conservé, signalé et bloque la création', async ({ page }) => {
    await page.goto('/');

    const secretInput = page.getByLabel('Secret :');
    const submit = page.getByRole('button', { name: 'Créer le lien' });
    const tooLong = 'x'.repeat(65);

    await secretInput.fill(tooLong);

    await expect(secretInput, 'le navigateur ne doit pas tronquer').toHaveValue(tooLong);
    await expect(page.getByText('Le secret fait 65 caractères')).toBeVisible();
    await expect(submit).toBeDisabled();

    await secretInput.fill(tooLong.slice(0, 64));

    await expect(page.getByText('64 / 64')).toBeVisible();
    await expect(submit).toBeEnabled();
  });
});
