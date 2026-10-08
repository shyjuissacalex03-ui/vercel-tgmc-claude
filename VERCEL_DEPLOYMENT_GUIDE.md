# Deploying TGMC to Vercel (vercel.com)

This website is a **Vite + React (TypeScript) Single Page Application (SPA)** with Firebase Firestore, Authentication, and Storage. It is fully configured and ready for 1-click deployment on Vercel.

---

## 1. Quick Deploy Steps

### Method A: Deploy via GitHub / GitLab / Bitbucket (Recommended)
1. Push this codebase to your Git repository (e.g., GitHub).
2. Go to [vercel.com](https://vercel.com/) and click **"Add New Project"**.
3. Import your Git repository.
4. Vercel will automatically detect the **Vite** framework preset:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: leave on the default (Vercel sees `bun.lock` and installs with Bun)
5. Click **"Deploy"**.

### Method B: Deploy via Vercel CLI
If you have the Vercel CLI installed locally:
```bash
npm install -g vercel
vercel
# Follow the prompts and select default settings
vercel --prod
```

---

## 2. Included Configurations

### SPA Routing (`vercel.json`)
`vercel.json` sends every page URL (`/about`, `/events`, `/give`, …) to `index.html`, so deep links and
browser refreshes work. Real files under `/assets/` and `/images/` are **not** rewritten, so a missing
image or an out-of-date script returns a proper 404 instead of the home page.

---

## 3. Firebase setup you must do once (the site will not fully work without these)

All of this is in the [Firebase Console](https://console.firebase.google.com/) for project **`orbital-talent-vvr20`**.

### 3.1 Allow your Vercel domain to sign in
**Build → Authentication → Settings → Authorized domains → Add domain**, then add:
- `your-project-name.vercel.app`
- any custom domain (e.g. `tgmchurch.uk`)

Without this, Google sign-in fails with "unauthorized domain".

### 3.2 Turn on the sign-in methods
**Authentication → Sign-in method** → enable **Google** and **Email/Password**.

### 3.3 Publish the Firestore security rules
The rules in `firestore.rules` are **not** deployed by Vercel. Publish them either way:

- **Console:** Firestore Database → pick the database
  `ai-studio-thegreatmissionc-b0a51e3f-cce4-4e2e-82a7-5d9b232e1cc3` in the database drop-down (not `(default)`)
  → **Rules** → paste the contents of `firestore.rules` → **Publish**.
- **Command line:** `npx firebase-tools login` then
  `npx firebase-tools deploy --only firestore:rules` (uses `firebase.json` / `.firebaserc` in this repo).

### 3.4 Turn on Storage and publish the Storage rules (needed for image uploads in the editor)
1. **Build → Storage → Get started** (Firebase now requires the pay-as-you-go *Blaze* plan for Storage;
   a small church site normally stays inside the free allowance).
2. **Storage → Rules** → paste the contents of `storage.rules` → **Publish**
   (or `npx firebase-tools deploy --only storage`).

### 3.5 Administrator account
Only **`shyjuissacalex03@gmail.com`** can edit the site, and only once that email is **verified**:
- Signing in with **Google** is verified automatically (recommended).
- If you sign in with email + password, open **My Account** on the site and use
  *Send verification email* → click the link → *I've verified*.

To change the administrator, update the address in three places and redeploy / republish:
`src/firebase/authContext.tsx` (`ADMIN_EMAIL`), `firestore.rules`, `storage.rules`.

Also check **Firestore → `admins` collection**: it should contain only your own account. Anyone listed
there is treated as an administrator by the rules.

### 3.6 Where visitor messages go
Contact messages, prayer requests and RSVPs are stored in Firestore (`contactMessages`,
`prayerRequests`, `eventRsvps`). The site does **not** send email notifications — read them in the
Firebase Console.

---

## 4. Optional: environment variable

The Firebase web config is read from `firebase-applet-config.json`. The only supported override is:

| Variable Name | Purpose |
|---|---|
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Use a different Firestore database (e.g. a test database). |

---

## 5. Optional: play the live stream inside the site

In the site editor → **General & Contacts** → **YouTube Channel ID**, paste your channel ID (starts with
`UC`, from YouTube Studio → Settings → Channel → Advanced settings). Until then, "Watch Live" links to
your YouTube channel.
