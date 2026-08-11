import { ISODateTime } from '../../models/das.models';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error';
export type IntegrationCategory = 'gis' | 'postal' | 'gov' | 'analytics' | 'storage';

export interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  descriptionKey: string;
  icon: string;
  status: IntegrationStatus;
  lastSync: ISODateTime | null;
}

export interface IntegrationsData {
  items: Integration[];
  connectedCount: number;
}
