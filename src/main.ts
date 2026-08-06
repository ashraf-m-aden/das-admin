import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { AppConfigService } from './app/core/config/app-config.service';

fetch('config.json')
  .then((res) => res.json())
  .then((config) => {
    AppConfigService.preload(config);
    return bootstrapApplication(AppComponent, appConfig);
  })
  .catch((err) => console.error('Impossible de charger config.json au démarrage :', err));