// src/environments/environment.ts
// 🔧 Replace these values with your Firebase project config
// Get them from: Firebase Console → Project Settings → Your apps → Web app
export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyACwe4MHPqEmerx1ZC3xa71O25uj919NUQ',
    // Matches the actual Firebase Hosting domain (app-50cb9.web.app), not the default
    // *.firebaseapp.com one — keeps Auth's sign-in iframe same-origin with the app, which
    // Firefox/Safari/Chrome's storage-partitioning protections otherwise block outright.
    authDomain: 'app-50cb9.web.app',
    projectId: 'app-50cb9',
    storageBucket: 'app-50cb9.firebasestorage.app',
    messagingSenderId: '100743146316',
    appId: '1:100743146316:web:15959a5aa3a6ed4ef33de9'
  },
  // reCAPTCHA Enterprise site key for Firebase App Check, required to call the DVD scan's
  // Gemini API (v3 Classic is no longer accepted for new App Check registrations). Create a
  // Web key at https://console.cloud.google.com/security/recaptcha (score-based, not
  // checkbox), then register that same key in Firebase Console → App Check → your web app.
  // See README "Enable Firebase AI Logic" step.
  recaptchaSiteKey: '6LeuFMctAAAAAKZeHNRGjlpW2yaicTUZymri_ybH',
  // TMDb (themoviedb.org) v4 Read Access Token — used to fetch official poster art for the
  // DVD library's "find posters online" feature. Free, no billing; sent as a Bearer token,
  // not a URL param. Get one at themoviedb.org → Settings → API → "API Read Access Token".
  // Unlike the values above, keep your real token out of version control if this repo is
  // public — it's a real credential, not a design-to-be-public key like the ones above.
  tmdbAccessToken: 'YOUR_TMDB_READ_ACCESS_TOKEN'
};
