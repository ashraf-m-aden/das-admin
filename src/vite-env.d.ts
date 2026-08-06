// Déclarations pour les imports "virtuels" de Vite utilisés par MapLibre v6.
// Le suffixe ?worker&url renvoie l'URL (string) d'un worker empaqueté par Vite.
declare module '*?worker&url' {
  const workerUrl: string;
  export default workerUrl;
}

declare module '*?url' {
  const url: string;
  export default url;
}
