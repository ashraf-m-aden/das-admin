import { inject } from '@angular/core';
import { AppConfigService } from './app-config.service';

export type FeatureKey =
  | 'adresse' | 'blocks' | 'addressing' | 'review' | 'fieldops' | 'staff'
  | 'hierarchy' | 'reference' | 'units' | 'dataquality' | 'dashboard'
  | 'postcodes' | 'closes' | 'notifications' | 'reports' | 'audit' | 'clients'
  | 'integrations' | 'settings';

export type BackendStatus = 'wired' | 'mock';

export interface FeatureReadiness {
  status: BackendStatus;
  /** Routes réelles consommées. Vide si `mock`. Sert de trace, pas de contrôle runtime. */
  routes: string[];
  /** Pourquoi ce n'est pas câblé — affiché en infobulle du badge. Clé i18n. */
  noteKey?: string;
}

/**
 * État de câblage relevé le 2026-08-23 dans la source `dasApi`
 * (`src/DASApi.WebApi/Features/**\/*Endpoints.cs`), pas dans `docs/openapi-v1.json` qui dérive
 * du réel. Voir docs/plans/lot-cablage-mock-adresse-postcodes.md §0 pour le détail du relevé.
 *
 * `status: 'wired'` engage : posé seulement si TOUTES les méthodes du port concerné tapent une
 * route qui existe. Un module à moitié câblé reste `'mock'`. `routes` se relit à la main contre
 * la source dasApi — pas de vérification automatique (cf. §1.5 du plan).
 */
export const BACKEND_READINESS: Record<FeatureKey, FeatureReadiness> = {
  adresse: { status: 'wired', routes: ['/api/adresses', '/api/adresses/{id}', '/api/adresses/summary', '/api/adresses/filter-options', '/api/adresses/search', '/api/adresses/bulk'] },
  blocks: { status: 'wired', routes: ['/api/blocs'] },
  addressing: { status: 'wired', routes: ['/api/blocs', '/api/streets', '/api/blocs/suggestions', '/api/streets/suggestions'] },
  review: { status: 'wired', routes: ['/api/surveys'] },
  fieldops: { status: 'wired', routes: ['/api/campaigns', '/api/campaign-assignments', '/api/campaigns/{id}/blocs', '/api/campaign-blocs/transfer'] },
  staff: { status: 'wired', routes: ['/api/users', '/api/surveys/productivity'] },
  hierarchy: { status: 'wired', routes: ['/api/cities', '/api/communes', '/api/zones', '/api/quartiers'] },
  reference: { status: 'wired', routes: ['/api/types-occupation', '/api/etats-occupation'] },
  units: { status: 'wired', routes: ['/api/units'] },
  dataquality: { status: 'wired', routes: ['/api/surveys/suspicious'] },
  dashboard: { status: 'wired', routes: ['/api/adresses/summary', '/api/campaigns/{id}/progress'] },
  postcodes: { status: 'wired', routes: ['/api/quartiers', '/api/quartiers/{id}', '/api/cities', '/api/cities/{id}'] },

  closes: { status: 'mock', routes: [], noteKey: 'mockBadge.closes' },

  notifications: { status: 'mock', routes: [], noteKey: 'mockBadge.notifications' },
  reports: { status: 'mock', routes: [], noteKey: 'mockBadge.reports' },
  audit: { status: 'mock', routes: [], noteKey: 'mockBadge.audit' },
  clients: { status: 'mock', routes: [], noteKey: 'mockBadge.clients' },
  integrations: { status: 'mock', routes: [], noteKey: 'mockBadge.integrations' },
  settings: { status: 'mock', routes: [], noteKey: 'mockBadge.settings' },
};

/** true si l'écran doit consommer le mock : toggle global OU absence de back câblé. */
export const shouldUseMock = (feature: FeatureKey): boolean =>
  inject(AppConfigService).get('useMockApi') || BACKEND_READINESS[feature].status === 'mock';
