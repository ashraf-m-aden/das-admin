import { bootstrapApplication } from '@angular/platform-browser';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { AppConfigService } from './app/core/config/app-config.service';

// MapLibre v6 est ESM-only et charge son worker de rendu depuis un fichier
// séparé au runtime. Avec un bundler (Vite/esbuild via Angular), l'URL du
// worker n'est pas résolue automatiquement : sans ce setWorkerUrl(), le
// worker ne se charge pas et AUCUNE géométrie (polygones, lignes) ne s'affiche
// — seul le fond de carte est peint. Le suffixe ?worker&url est obligatoire
// (et non ?url) pour que Vite empaquette aussi le fichier voisin
// maplibre-gl-shared.mjs dont le worker dépend.
setWorkerUrl(workerUrl);

fetch('config.json')
  .then((res) => res.json())
  .then((config) => {
    AppConfigService.preload(config);
    return bootstrapApplication(AppComponent, appConfig);
  })
  .catch((err) => console.error('Impossible de charger config.json au démarrage :', err));
