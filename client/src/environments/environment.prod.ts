export const environment = {
  production: true,
  // Relatif : l'API est servie sous la même origine, via le proxy /api de nginx.
  apiBaseUrl: '/api',
  // Absolu, contrairement à apiBaseUrl : sert à construire les liens partageables,
  // qui doivent rester valides hors du navigateur.
  frontBaseUrl: 'https://secret.nicob.ovh',
  chromeExtensionUrl: 'https://chromewebstore.google.com/detail/dbneilgepekkiaabbjdmhmakojcenpel',
};
