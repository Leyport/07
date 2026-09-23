# 🇫🇷 7 Leyport — House Guide App

An Angular 21 app for sharing info, photos, and videos about our house in France with the family.

## Features
- 🔓 Opening the house guide
- 🔒 Closing the house guide
- 💡 General tips
- 📷 Photo & video gallery with swipe/keyboard carousel lightbox, hover metadata (taken date, upload date, uploader), and drag-and-drop multi-file upload with progress
- 🔑 Google sign-in (Firebase Auth) — uploading, editing, and deleting media requires sign-in; browsing is open to everyone
- ☁️ Firebase Storage & Firestore for cloud media, with EXIF-based "date taken" extraction via `exifr`
- 📀 DVD Library — catalogue our film collection by genre/folder with search, plus an AI photo-scan (Gemini via Firebase AI Logic) that identifies films from a photo of the disc(s) and drafts a summary for you to review before saving
- ℹ️ About page showing app version, commit hash, and build date
- 📱 Mobile-friendly, works on phones and tablets
- 🌙 Automatic dark mode

---

## Setup Instructions

### Step 1 — Check your Node version
This app requires **Node.js v22 or v24**. Check yours:
```bash
node --version
```
If it's below v22, download the latest from [nodejs.org](https://nodejs.org).

### Step 2 — Install Angular CLI
```bash
npm install -g @angular/cli@^21
```

### Step 3 — Install dependencies
Navigate to the project folder and run:
```bash
npm install
```

### Step 4 — Set up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable **Firestore Database** (start in test mode)
4. Enable **Storage** (start in test mode)
5. Enable **Authentication → Google** sign-in provider
6. Go to **Project Settings → Your apps → Add app → Web**
7. Copy your config and paste it into:
   ```
   src/environments/environment.ts
   src/environments/environment.prod.ts
   ```
   Replace all the `YOUR_...` placeholders.

### Step 5 — Set up Firestore index
In Firebase Console → Firestore → Indexes, add a composite index:
- Collection: `media`
- Fields: `section` (Ascending), `order` (Ascending)

### Step 6 — Enable Firebase AI Logic (for the DVD library's photo scanning)
The DVD Library section uses Gemini to identify films from a photo of the disc(s). To turn that on:
1. In the Firebase Console, open **Build → AI Logic** (sometimes listed as "Vertex AI in Firebase" / "Generative AI").
2. Click **Get started**. The app uses the **Vertex AI Gemini API** backend (`VertexAIBackend` in `dvds.service.ts`), which bills through this Firebase project's own linked Cloud Billing account — this requires the project to be on the **Blaze** (pay-as-you-go) plan. (We initially tried the Gemini Developer API's free tier instead, but as of Google's March 2026 billing changes it requires prepaying credits through a *separate* AI Studio billing system that, in practice, wasn't reliably recognizing top-ups — Vertex AI sidesteps that entirely.) Blaze still has generous free-tier allowances for everything else (Firestore, Storage, etc.), so this shouldn't meaningfully change costs outside of actual Gemini usage.
3. Enabling AI Logic turns on **App Check enforcement** for the Gemini API, which blocks every request until the app proves (via App Check) that it's really your app calling. Google now requires **reCAPTCHA Enterprise** for this on web — reCAPTCHA v3 Classic is no longer accepted for new App Check registrations — so:
   1. Go to Google Cloud Console → [Security → reCAPTCHA](https://console.cloud.google.com/security/recaptcha) (make sure your Firebase project is selected). Enable the reCAPTCHA Enterprise API if prompted.
   2. Create a **Web** key. Add your real domains (`YOUR-PROJECT.web.app`, `YOUR-PROJECT.firebaseapp.com`) — **do not** add `localhost` to this key. Leave "Use checkbox challenge" unchecked (App Check needs the invisible, score-based kind). Copy the **key ID** it gives you.
   3. Paste that key into `recaptchaSiteKey` in `src/environments/environment.ts` and `environment.prod.ts`.
   4. In Firebase Console → **Build → App Check**, register your web app with the **reCAPTCHA Enterprise** provider using that same key.
   5. For local dev only: run `ng serve`, open the DVD Library, and try a scan — the browser console will log an **App Check debug token**. Copy it into Firebase Console → App Check → **Manage debug tokens** (top right ⋮ menu) so `localhost` is trusted too (this is also why `localhost` isn't added to the reCAPTCHA key itself in step 2).

Everything else in the DVD Library (browsing, search, manual entry) works without any of this — it's only needed for the AI photo-scan step.

### Step 7 — Deploy the poster-lookup Cloud Function (for "Find posters online")
The DVD Library's poster picker looks up official cover art on [TMDb](https://www.themoviedb.org). TMDb's access token is a real credential (unlike the values above, which are designed to be public), so it's kept server-side in a small Cloud Function rather than in any source file:
1. Get a free TMDb key: sign up at themoviedb.org → **Settings → API** → request a key ("Developer" is fine) → copy the **API Read Access Token** (the long one, not the short API key).
2. Install the function's dependencies: `cd functions && npm install && cd ..`
3. Store the token in Secret Manager (never paste it into a file) — run this yourself in a terminal, since it prompts interactively for the value:
   ```bash
   firebase functions:secrets:set TMDB_ACCESS_TOKEN --project YOUR_PROJECT_ID
   ```
4. Deploy the function: `firebase deploy --only functions --project YOUR_PROJECT_ID`

Everything else in the DVD Library works without this too — it's only needed for the online poster picker specifically (your own photos and the AI scan's cropped thumbnails don't need it).

### Step 8 — Run the app
```bash
ng serve
```
Then open [http://localhost:4200](http://localhost:4200)

---

## Project Structure
```
src/
  app/
    core/
      models/           # TypeScript interfaces (MediaItem, etc.)
      services/
        auth.service.ts   # Google sign-in via Firebase Auth
        media.service.ts  # Firestore/Storage CRUD for media
    features/
      home/             # Home page with section cards
      section/          # Shared component for opening/closing/tips content
      photos/           # Photo & video gallery, upload, lightbox carousel
      about/            # Version/build info page
    app.component.ts    # Root shell with nav + auth UI
    app.routes.ts       # Routing
    app.config.ts       # Firebase providers
    build-info.ts        # Generated at build time (version/commit/date)
  environments/         # Firebase config (fill these in!)
  styles.scss           # Global styles
scripts/
  set-version.mjs       # Generates build-info.ts before start/build
```

---

## Deploying

The app deploys to Firebase Hosting:
```bash
npm install -g firebase-tools
firebase login
ng build
firebase deploy
```
Hosting config lives in `firebase.json` / `.firebaserc`.
