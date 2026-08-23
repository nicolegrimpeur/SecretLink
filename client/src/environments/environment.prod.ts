export const environment = {
  production: true,
  // Relatif : l'API est servie sous la même origine, via le proxy /api de nginx.
  // Les liens partageables ne sont pas construits ici : l'API les renvoie dans
  // `link_url`, d'après son FRONT_BASE_URL. Aucun domaine n'est figé dans le bundle.
  apiBaseUrl: '/api',
  chromeExtensionUrl: 'https://chromewebstore.google.com/detail/dbneilgepekkiaabbjdmhmakojcenpel',
};
