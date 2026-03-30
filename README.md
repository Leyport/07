# 🇫🇷 Maison de France — House Guide App

An Angular 21 app for sharing photos and videos about your house in France with your children.

## Features
- 📷 Upload photos and videos for each section
- 🔓 Opening the house guide
- 🔒 Closing the house guide
- 💡 General tips
- ☁️ Firebase Storage & Firestore for cloud media
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
2. Create a new project (e.g. "maison-de-france")
3. Enable **Firestore Database** (start in test mode)
4. Enable **Storage** (start in test mode)
5. Go to **Project Settings → Your apps → Add app → Web**
6. Copy your config and paste it into:
   ```
   src/environments/environment.ts
   src/environments/environment.prod.ts
   ```
   Replace all the `YOUR_...` placeholders.

### Step 5 — Set up Firestore index
In Firebase Console → Firestore → Indexes, add a composite index:
- Collection: `media`
- Fields: `section` (Ascending), `order` (Ascending)

### Step 6 — Run the app
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
      models/         # TypeScript interfaces
      services/       # MediaService (Firebase)
    features/
      home/           # Home page with section cards
      section/        # Shared component for opening/closing/tips
    app.component.ts  # Root shell with navigation
    app.routes.ts     # Routing
    app.config.ts     # Firebase providers
  environments/       # Firebase config (fill these in!)
  styles.scss         # Global styles
```

---

## Deploying (optional)

To share with your children via a public URL:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
ng build
firebase deploy
```
