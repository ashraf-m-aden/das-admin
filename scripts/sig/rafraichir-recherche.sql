-- Rafraîchit l'index de recherche du référentiel — `public.recherche_index`.
--
-- Seul :
--   psql "$DB" -v ON_ERROR_STOP=1 -f scripts/sig/rafraichir-recherche.sql
--
-- Ou, et c'est le cas normal, inclus par `\ir` à la fin de chaque script qui écrit une table
-- source. Voir plus bas pourquoi une inclusion et non neuf copies de la commande.
--
-- ---------------------------------------------------------------------------------------------
-- POURQUOI CE FICHIER EXISTE
-- ---------------------------------------------------------------------------------------------
-- `recherche_index` est une vue MATÉRIALISÉE : elle ne se met pas à jour toute seule. Neuf
-- scripts écrivent les tables qui l'alimentent (`Cities`, `Quartiers`, `Streets`, `Adresses`,
-- `poi_sites_tiles`). Tant que le rafraîchissement reposait sur la mémoire de qui lançait
-- l'import, l'index dérivait en silence : la carte montrait une rue que la recherche ne trouvait
-- pas.
--
-- Depuis que la vue porte `ville_id`, l'enjeu a grandi. Une clé d'API restreinte à une ville
-- filtre sur cette colonne : une entrée absente de l'index n'est pas seulement introuvable, elle
-- est **invisible au partenaire qui a payé pour la voir**.
--
-- ⚠️ UN FICHIER INCLUS, ET NON LA COMMANDE RECOPIÉE NEUF FOIS. Le jour où le rafraîchissement
-- change — un index de plus, un contrôle supplémentaire — une copie oubliée ne se signale pas :
-- elle continue de tourner, en produisant autre chose que les huit autres.
--
-- ⚠️ `\ir` ET NON `\i` : `\ir` résout le chemin relativement au script INCLUANT, `\i`
-- relativement au répertoire courant de psql. Avec `\i`, l'inclusion ne marcherait que si l'on
-- lance psql depuis le bon dossier — c'est-à-dire par hasard.

-- ---------------------------------------------------------------------------------------------
-- ⚠️ CONCURRENTLY : hors transaction, obligatoirement
-- ---------------------------------------------------------------------------------------------
-- Postgres refuse `REFRESH ... CONCURRENTLY` dans un bloc de transaction. C'est pourquoi cette
-- inclusion se place APRÈS le `COMMIT` des scripts d'import, jamais entre `BEGIN` et `COMMIT`.
--
-- `CONCURRENTLY` exige aussi l'index unique sur `cle`, créé par `recherche-index.sql`. Sans lui,
-- la vue serait verrouillée pendant tout le rafraîchissement et la recherche publique tomberait —
-- pour plusieurs secondes, en pleine journée.
--
-- Si la vue n'existe pas encore, cette commande échoue franchement : c'est voulu. Le remède est
-- de lancer `recherche-index.sql`, qui la crée. Un échec bruyant vaut mieux qu'un index absent
-- dont personne ne s'aperçoit.
REFRESH MATERIALIZED VIEW CONCURRENTLY public.recherche_index;

-- ---------------------------------------------------------------------------------------------
-- CE QU'IL FAUT LIRE APRÈS COUP
-- ---------------------------------------------------------------------------------------------
-- `sans_ville` compte les entrées dont le point ne tombe dans l'emprise d'AUCUNE ville. Elles ne
-- sont servies qu'aux clés NON restreintes — une clé vendue pour une ville ne reçoit pas ce qu'on
-- ne sait pas rattacher.
--
-- Ce nombre doit rester petit et connu. Relevé de référence du 2026-09-10 : **46 sur 999**, soit
-- 4,6 % (34 lieux, 12 rues). S'il enfle après un import, la cause est en amont — une emprise de
-- ville trop étroite, ou de la donnée hors du pays — et c'est là qu'il faut la corriger, pas ici.
SELECT
  count(*)                                                  AS entrees,
  count(*) FILTER (WHERE ville_id IS NULL)                  AS sans_ville,
  round(100.0 * count(*) FILTER (WHERE ville_id IS NULL)
        / nullif(count(*), 0), 1)                           AS pourcent
FROM public.recherche_index;
