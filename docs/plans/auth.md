# Module Auth (authentification, JWT, RBAC)

## Contexte

Première feature du DAS : authentifier les utilisateurs (Admin, Superviseur, Agent de terrain, Gestionnaire) et contrôler leurs droits d'accès sur les futures features métier (Tâches, Routes...).

## Décisions clés

- **RBAC many-to-many explicite** : `User ↔ Role` et `Role ↔ Permission` via tables de jointure `UserRole`/`RolePermission` (Domain), pas de `[Flags]` enum ni de skip-navigation EF Core. Permet plusieurs rôles par utilisateur et plusieurs permissions par rôle sans contrainte figée dans le code.
- **Noms de rôles en constantes, pas en enum** : `Role` est une entité seedée (table `Roles`), donc ses valeurs possibles vivent dans `Domain/Identity/Constants/RoleNames.cs` plutôt que dans un enum C#.
- **Admin = bypass total en code**, pas de lignes `RolePermission` seedées pour lui. `PermissionAuthorizationHandler` court-circuite le check via `IsInRole(RoleNames.Admin)`. Conséquence : une nouvelle permission ajoutée au catalogue n'a jamais besoin de backfill sur Admin.
- **Refresh token jamais stocké en clair** : seul son hash SHA-256 est persisté (`RefreshToken.TokenHash`), via `IRefreshTokenGenerator` — différent de `IPasswordHasher`/BCrypt (non déterministe, donc impossible à chercher par égalité en base).
- **Rotation du refresh token** à chaque `POST /api/auth/refresh` : l'ancien token est révoqué et remplacé. Si un token déjà révoqué est présenté à nouveau (signe de vol), tous les tokens actifs de l'utilisateur sont révoqués en cascade.
- **`POST /api/auth/logout` idempotent** : renvoie toujours `204`, même si le token est déjà révoqué ou inconnu, pour ne pas donner d'information sur son état. Anonyme comme `login`/`refresh` — posséder le refresh token suffit.

## État actuel

Fait : `Login`, `RefreshAccessToken`, `Logout`, `CreateUser`, `GetUsers`, `SetUserRoles`, `SetUserActiveStatus`.

Pas encore fait :
- **2FA** — prévue plus tard, non implémentée.
- Projet de tests — n'existe pas encore dans la solution.

Détail complet des conventions et pièges de dev (seed, migration `AddRolesAndPermissions`, syntaxe Rider vs VS Code REST Client) : voir la section "Notes sur l'état actuel" de `CLAUDE.md`, qui reste la référence exhaustive pour ce module.
