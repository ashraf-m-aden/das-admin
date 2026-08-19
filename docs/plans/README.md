# Plans par module

Ce dossier garde une trace durable, versionnée, des décisions de conception prises pour chaque module fonctionnel du DAS (Auth, Recensement/Géographie, futurs modules Tâches/Routes...).

Différence avec le mode `/plan` de Claude Code : les fichiers générés par `/plan` vivent dans `~/.claude/plans/` (hors repo, un fichier par session, éphémère — supprimé/oublié une fois la tâche implémentée). Les fichiers ici sont au contraire :
- **Versionnés** avec le code, dans l'historique Git.
- **Un fichier par module**, pas par session de travail — un module se met à jour au fil du temps plutôt que d'accumuler des doublons.
- **Une référence durable** : elle explique le *pourquoi* des choix (utile pour un futur handler, une migration, une revue de PR), pas une checklist d'exécution ponctuelle.

## Convention

Un fichier `docs/plans/<module>.md` par module, avec :
- **Contexte** : le besoin métier qui a motivé le module.
- **Décisions clés** : choix de conception non triviaux et leur raison (surtout ceux qui ne sont pas évidents en lisant juste le code).
- **Entités / structure** : vue d'ensemble, sans dupliquer le détail déjà dans `CLAUDE.md` (qui reste la source de vérité pour les conventions transverses du repo).
- **État actuel** : ce qui est fait, ce qui ne l'est pas encore (TODO explicites).

Mettre à jour le fichier du module concerné à chaque changement de conception significatif — pas besoin d'un nouveau fichier à chaque itération.
