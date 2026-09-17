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
2. Click **Get started**, and when asked which API to use, choose **Gemini Developer API** — it has a free tier and needs no billing upgrade.
3. That's it — no API key to copy anywhere; the app talks to it the same way it already talks to Firestore/Storage.

Everything else in the DVD Library (browsing, search, manual entry) works without this step.

### Step 7 — Run the app
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
