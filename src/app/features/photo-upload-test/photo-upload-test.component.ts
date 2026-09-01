import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../core/config/app-config.service';

/* =============================================================================
 * ÉCRAN JETABLE — test du téléversement de photo par URL pré-signée.
 *
 * Tout est ICI volontairement : contrats, appels HTTP, génération de vignette. Rien n'est
 * branché sur un store, une facade ou un port. Pour le supprimer, il suffit de retirer
 * ce dossier et la route `photo-test` de `app.routes.ts` — rien d'autre ne le référence.
 * ========================================================================== */

/** Réponse de `POST /api/surveys/{id}/photos/upload-url`. */
interface PhotoUploadUrlResponse {
  photoId: string;
  objectKey: string;
  uploadUrl: string;
  thumbnailUploadUrl: string;
  contentType: string;
  maxBytes: number;
  expiresAtUtc: string;
}

interface DraftSurvey {
  id: string;
  status: string;
  adresseLibelle: string | null;
  photoCount: number;
}

/** Une étape du parcours, telle qu'affichée. */
interface Etape {
  libelle: string;
  etat: 'en cours' | 'ok' | 'échec';
  detail: string;
}

@Component({
  selector: 'das-photo-upload-test',
  standalone: true,
  templateUrl: './photo-upload-test.component.html',
  styleUrl: './photo-upload-test.component.scss',
})
export class PhotoUploadTestComponent {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get api() { return this.config.get('apiBaseUrl'); }

  protected readonly surveyId = signal('');
  protected readonly drafts = signal<DraftSurvey[]>([]);
  protected readonly etapes = signal<Etape[]>([]);
  protected readonly enCours = signal(false);
  protected readonly fichier = signal<File | null>(null);

  private journal(libelle: string, etat: Etape['etat'], detail = ''): void {
    this.etapes.update((e) => [...e, { libelle, etat, detail }]);
  }

  private majDerniere(etat: Etape['etat'], detail: string): void {
    this.etapes.update((e) => e.map((x, i) => (i === e.length - 1 ? { ...x, etat, detail } : x)));
  }

  onFile(event: Event): void {
    this.fichier.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  /**
   * Les brouillons de l'utilisateur connecté. `GET /api/surveys` restreint déjà la liste à
   * l'agent appelant : c'est utile ici, parce que le téléversement n'est possible QUE sur un
   * relevé dont on est l'auteur — inutile de proposer ceux des autres.
   */
  async chargerBrouillons(): Promise<void> {
    this.etapes.set([]);
    this.journal('GET /api/surveys?status=Draft', 'en cours');
    try {
      const rows = await firstValueFrom(
        this.http.get<DraftSurvey[]>(`${this.api}/surveys`, { params: { status: 'Draft' } }),
      );
      this.drafts.set(rows);
      if (rows.length) this.surveyId.set(rows[0].id);
      this.majDerniere('ok', `${rows.length} brouillon(s)`);
    } catch (e) {
      this.majDerniere('échec', this.decrire(e));
    }
  }

  /**
   * Vignette produite dans le navigateur, comme le mobile la produit sur le téléphone.
   *
   * Elle n'est PAS optionnelle : la confirmation refuse (`SurveyPhotos.ThumbnailMissing`) tant
   * qu'elle n'est pas déposée. Sortie en JPEG parce que le `Content-Type` est épinglé dans la
   * signature — un PNG ferait échouer le PUT côté S3, avant même d'atteindre l'API.
   */
  private async vignette(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const cote = 320;
    const ratio = Math.min(cote / bitmap.width, cote / bitmap.height, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('vignette illisible'))), 'image/jpeg', 0.7));
  }

  /**
   * Dépôt direct dans le bucket.
   *
   * `fetch` et non `HttpClient` : l'intercepteur d'authentification ajoute un
   * `Authorization: Bearer` à TOUTE requête HttpClient. Sur une URL déjà signée, S3 verrait
   * deux mécanismes d'authentification concurrents et refuserait la requête.
   *
   * Le `Content-Type` doit valoir exactement celui demandé à l'étape 1 : il fait partie de la
   * signature, un en-tête différent invalide l'URL.
   */
  private async deposer(url: string, corps: Blob, contentType: string): Promise<void> {
    const r = await fetch(url, { method: 'PUT', body: corps, headers: { 'Content-Type': contentType } });
    if (!r.ok) throw new Error(`S3 ${r.status} ${r.statusText} — ${(await r.text()).slice(0, 300)}`);
  }

  async lancer(): Promise<void> {
    const file = this.fichier();
    const id = this.surveyId().trim();
    if (!file || !id) return;

    this.etapes.set([]);
    this.enCours.set(true);
    const photoId = crypto.randomUUID();

    try {
      // --- 1. demander les deux URLs signées ---------------------------------
      this.journal(`1. POST /surveys/${id}/photos/upload-url`, 'en cours');
      const signe = await firstValueFrom(this.http.post<PhotoUploadUrlResponse>(
        `${this.api}/surveys/${id}/photos/upload-url`,
        { photoId, contentType: 'image/jpeg' },
      ));
      this.majDerniere('ok',
        `objectKey=${signe.objectKey} · maxBytes=${signe.maxBytes} · expire=${signe.expiresAtUtc}`);

      // Le plafond se verifie AVANT d'envoyer : une URL PUT signee ne peut pas le borner, le
      // refus n'arriverait qu'a l'etape 3, quand les octets ont deja transite.
      if (file.size > signe.maxBytes) {
        this.journal('Refus local', 'échec',
          `${file.size} octets > maxBytes ${signe.maxBytes} — inutile d'envoyer.`);
        return;
      }

      // --- 2. déposer les octets directement dans le bucket -------------------
      this.journal('2. PUT photo → S3', 'en cours');
      await this.deposer(signe.uploadUrl, file, signe.contentType);
      this.majDerniere('ok', `${file.size} octets`);

      this.journal('2b. PUT vignette → S3', 'en cours');
      const vignette = await this.vignette(file);
      await this.deposer(signe.thumbnailUploadUrl, vignette, signe.contentType);
      this.majDerniere('ok', `${vignette.size} octets`);

      // --- 3. confirmer, sans quoi la photo reste invisible -------------------
      this.journal(`3. POST /surveys/${id}/photos`, 'en cours');
      const ligne = await firstValueFrom(this.http.post<{ id: string; readUrl: string; thumbnailUrl: string | null }>(
        `${this.api}/surveys/${id}/photos`, { photoId },
      ));
      this.majDerniere('ok', `ligne ${ligne.id} · vignette ${ligne.thumbnailUrl ? 'oui' : 'non'}`);
      this.apercu.set(ligne.thumbnailUrl ?? ligne.readUrl);
    } catch (e) {
      this.majDerniere('échec', this.decrire(e));
    } finally {
      this.enCours.set(false);
    }
  }

  protected readonly apercu = signal<string | null>(null);

  /**
   * Les erreurs métier arrivent en `{ code, message }`, les refus S3 en texte brut, et une
   * coupure CORS en `status: 0` sans corps — ce dernier cas est le plus trompeur, il faut le
   * nommer pour ne pas le prendre pour une panne du backend.
   */
  private decrire(e: unknown): string {
    const err = e as { status?: number; error?: { code?: string; message?: string } | string; message?: string };
    if (err?.status === 0) {
      return 'Requête bloquée par le navigateur (CORS ou serveur injoignable) — voir la note en bas de page.';
    }
    if (err?.error && typeof err.error === 'object' && err.error.code) {
      return `${err.error.code} — ${err.error.message ?? ''}`;
    }
    if (typeof err?.error === 'string' && err.error) return err.error;
    return err?.message ?? String(e);
  }
}
