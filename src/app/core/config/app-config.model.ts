export interface AppRuntimeConfig {
  apiBaseUrl: string;
  mapTileUrl: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  environment: 'development' | 'staging' | 'production';
  useMockApi: boolean;
}
