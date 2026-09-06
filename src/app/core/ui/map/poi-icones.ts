/**
 * Icônes des bâtiments remarquables, dessinées à l'exécution pour MapLibre.
 *
 * POURQUOI PAS UN SPRITE. MapLibre ne sait afficher un `icon-image` que depuis un sprite —
 * une planche PNG plus son index JSON, à générer et à versionner. `map-style.json` n'en déclare
 * aucun, et en introduire un obligerait à régénérer la planche à chaque icône ajoutée, avec un
 * jeu d'images en double de celles que l'interface utilise déjà.
 *
 * Tabler est chargé comme POLICE (`@tabler/icons-webfont`, cf. `styles.scss`). On dessine donc
 * chaque glyphe dans un canvas et on l'enregistre par `map.addImage()`. Les icônes de la carte
 * sont alors littéralement les mêmes que celles des boutons — aucune divergence possible, et
 * ajouter une catégorie tient en une ligne ici.
 *
 * ⚠️ Le nom de l'image DOIT valoir `poi-<categorie>` : `map-style.json` le compose avec
 * `["concat", "poi-", ["get", "Categorie"]]`. Une catégorie sans entrée ici est stockée en base
 * et **invisible sur la carte**, sans la moindre erreur — même piège que `Streets."Type"` hors
 * du vocabulaire des filtres.
 *
 * Les valeurs viennent de `scripts/sig/nour/poi-osm-extraire.py`, qui fixe le vocabulaire fermé.
 */

/** Glyphes relevés dans `tabler-icons.min.css` : une catégorie, une icône, une couleur. */
const CATEGORIES: ReadonlyArray<{ categorie: string; glyphe: string; couleur: string }> = [
  { categorie: 'sante',          glyphe: '\uedbe', couleur: '#dc2626' }, // ti-stethoscope
  { categorie: 'education',      glyphe: '\uecf7', couleur: '#2563eb' }, // ti-school
  { categorie: 'culte',          glyphe: '\ufa57', couleur: '#7c3aed' }, // ti-building-mosque
  { categorie: 'administration', glyphe: '\uebf6', couleur: '#0f766e' }, // ti-building-community
  { categorie: 'hebergement',    glyphe: '\ueb5c', couleur: '#d97706' }, // ti-bed
  { categorie: 'commerce',       glyphe: '\ueb25', couleur: '#c2410c' }, // ti-shopping-cart
  { categorie: 'transport',      glyphe: '\uebe4', couleur: '#0891b2' }, // ti-bus
  { categorie: 'securite',       glyphe: '\ueb24', couleur: '#1d4ed8' }, // ti-shield
  { categorie: 'finance',        glyphe: '\uebe2', couleur: '#15803d' }, // ti-building-bank
  { categorie: 'sport',          glyphe: '\uee06', couleur: '#65a30d' }, // ti-ball-football
  { categorie: 'culture',        glyphe: '\ued26', couleur: '#9333ea' }, // ti-building-monument
];

/** Ids d'image attendus par la couche `poi-icone`. Sert au panneau de couches et aux tests. */
export const POI_CATEGORIES: readonly string[] = CATEGORIES.map((c) => c.categorie);

const TAILLE = 26;

/**
 * Dessine une pastille blanche cerclée portant le glyphe. Le fond opaque est nécessaire : sur
 * un aplat de quartier ou un bâti sombre, un glyphe seul devient illisible.
 */
function dessiner(glyphe: string, couleur: string, ratio: number): ImageData | null {
  const cote = TAILLE * ratio;
  const canvas = document.createElement('canvas');
  canvas.width = cote;
  canvas.height = cote;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const r = cote / 2;
  ctx.beginPath();
  ctx.arc(r, r, r - ratio, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1.5 * ratio;
  ctx.strokeStyle = couleur;
  ctx.stroke();

  ctx.fillStyle = couleur;
  ctx.font = `${15 * ratio}px "tabler-icons"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyphe, r, r);

  return ctx.getImageData(0, 0, cote, cote);
}

/**
 * Enregistre les icônes sur une instance MapLibre. Idempotent : `hasImage` évite le
 * réenregistrement quand le style est rechargé.
 *
 * ⚠️ La police doit être PRÊTE avant le tracé, sinon le canvas rend le caractère de repli et les
 * icônes sortent en carrés vides. `document.fonts.load` est attendu ; en cas d'échec on dessine
 * quand même — une pastille de couleur vaut mieux qu'une couche absente.
 */
export async function enregistrerIconesPoi(map: {
  hasImage(id: string): boolean;
  addImage(id: string, image: ImageData, options?: { pixelRatio?: number }): void;
}): Promise<void> {
  const ratio = Math.min(Math.max(Math.round(window.devicePixelRatio || 1), 1), 2);
  try {
    await document.fonts.load(`${15 * ratio}px "tabler-icons"`, '');
  } catch {
    /* police indisponible : on dessine quand même, cf. commentaire ci-dessus */
  }

  for (const { categorie, glyphe, couleur } of CATEGORIES) {
    const id = `poi-${categorie}`;
    if (map.hasImage(id)) continue;
    const image = dessiner(glyphe, couleur, ratio);
    if (image) map.addImage(id, image, { pixelRatio: ratio });
  }
}
