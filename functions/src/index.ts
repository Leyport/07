import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

// Stored in Google Secret Manager (`firebase functions:secrets:set TMDB_ACCESS_TOKEN`) —
// never in a source file, so it can't end up in the (public) git repo or the client bundle.
const tmdbAccessToken = defineSecret('TMDB_ACCESS_TOKEN');

interface PosterOption {
  url: string;
}

/**
 * Looks up a film on TMDb and returns its available poster art as thumbnail-sized image URLs,
 * best-rated first. Called from the DVD library's "Find posters online" picker. Requires the
 * same signed-in + approved status as any other write in the app, checked here directly since
 * Cloud Functions bypass Firestore security rules.
 */
export const searchDvdPosters = onCall(
  { secrets: [tmdbAccessToken] },
  async (request): Promise<PosterOption[]> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const userSnap = await getFirestore().doc(`users/${request.auth.uid}`).get();
    const userData = userSnap.data();
    if (!userData || (!userData['approved'] && !userData['admin'])) {
      throw new HttpsError('permission-denied', 'Your account is not approved yet.');
    }

    const title = String(request.data?.title ?? '').trim();
    const year = request.data?.year ? Number(request.data.year) : undefined;
    if (!title) {
      throw new HttpsError('invalid-argument', 'A title is required.');
    }

    const headers = { Authorization: `Bearer ${tmdbAccessToken.value()}`, accept: 'application/json' };

    const searchUrl = new URL('https://api.themoviedb.org/3/search/movie');
    searchUrl.searchParams.set('query', title);
    if (year) searchUrl.searchParams.set('year', String(year));

    const searchRes = await fetch(searchUrl, { headers });
    if (!searchRes.ok) throw new HttpsError('unavailable', `TMDb search failed (${searchRes.status}).`);
    const searchData = (await searchRes.json()) as { results?: { id: number }[] };
    const match = searchData.results?.[0];
    if (!match) return [];

    const imagesRes = await fetch(`https://api.themoviedb.org/3/movie/${match.id}/images`, { headers });
    if (!imagesRes.ok) throw new HttpsError('unavailable', `TMDb images lookup failed (${imagesRes.status}).`);
    const imagesData = (await imagesRes.json()) as {
      posters?: { file_path: string; vote_average: number; iso_639_1: string | null }[];
    };

    return (imagesData.posters ?? [])
      .filter(p => p.iso_639_1 === 'en' || p.iso_639_1 === null)
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, 6)
      .map(p => ({ url: `https://image.tmdb.org/t/p/w342${p.file_path}` }));
  }
);
