export interface AppRuntimeConfig {
  apiBaseUrl: string;
  /**
   * Racine du service de tuiles. Depuis le 2026-09-10 elle pointe sur le RELAIS de l'API
   * (`/api/tiles`) et non plus sur Martin : Martin auto-publie 34 sources, dont les tables du
   * recensement, et ne sait valider ni jeton ni clé.
   */
  mapTileUrl: string;

  /**
   * Racine des tuiles PUBLIQUES — le relais à liste blanche, protégé par clé.
   * `/api/public/tiles` en production.
   */
  mapPublicTileUrl: string;

  /**
   * Clé de la carte publique. **Publique par nature** : elle voyage dans les URL de tuiles que
   * le navigateur émet, exactement comme un jeton Mapbox. Ce qu'elle apporte n'est pas le secret
   * mais la RÉVOCABILITÉ et l'attribution — savoir qui consomme, et pouvoir couper.
   */
  mapPublicKey: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  environment: 'development' | 'staging' | 'production';
  useMockApi: boolean;
}
