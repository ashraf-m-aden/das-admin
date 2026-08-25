/**
 * Emprise [minLng, minLat, maxLng, maxLat] d'une géométrie WKT (POLYGON/MULTIPOLYGON, SRID 4326).
 * Pas un parseur WKT complet — on n'a besoin que de l'étendue pour cadrer la carte, donc on
 * se contente d'extraire tous les nombres du texte (les paires lng/lat alternent quelle que
 * soit la profondeur d'imbrication des anneaux).
 */
export function wktBounds(wkt: string): [number, number, number, number] | null {
  const nums = wkt.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 4) return null;

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const lng = Number(nums[i]);
    const lat = Number(nums[i + 1]);
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** Union de plusieurs emprises — `null` ignoré. */
export function unionBounds(boxes: Array<[number, number, number, number] | null>): [number, number, number, number] | null {
  const valid = boxes.filter((b): b is [number, number, number, number] => b !== null);
  if (!valid.length) return null;
  return [
    Math.min(...valid.map((b) => b[0])),
    Math.min(...valid.map((b) => b[1])),
    Math.max(...valid.map((b) => b[2])),
    Math.max(...valid.map((b) => b[3])),
  ];
}

/**
 * Point GeoJSON d'un WKT `POINT(lng lat)` (SRID 4326), ou `null` si le texte n'en est pas un.
 *
 * Volontairement strict, contrairement à `wktBounds` : celui-ci ne sert qu'à cadrer, alors
 * qu'ici on produit une géométrie affichée. Accepter `POLYGON(...)` en n'y prenant que les deux
 * premiers nombres placerait un repère sur un coin d'emprise, ce qui se voit mal et se croit.
 */
export function wktPoint(wkt: string): { type: 'Point'; coordinates: [number, number] } | null {
  const m = /^\s*POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)\s*$/i.exec(wkt);
  if (!m) return null;
  // Ordre WKT et ordre GeoJSON coïncident : longitude d'abord. Ne pas « corriger ».
  return { type: 'Point', coordinates: [Number(m[1]), Number(m[2])] };
}
