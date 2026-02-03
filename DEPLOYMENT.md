# Deployment (Recommended)

## Best Option (Free + Full-Stack): Render
Render can run the existing Node server so all routes and APIs work without refactors.

### Steps
1. Create a Render account.
2. Click **New > Web Service** and connect the repo.
3. Set **Start Command**:
   ```
   npm start
   ```
4. Add Environment Variables:
   - `SCORECARD_API_KEY`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_SERVICE_ACCOUNT` (paste JSON contents or use Render secret file)
   - `PORT` (optional; Render sets this automatically)
5. Deploy.

### Notes
- Render free tier may sleep on inactivity.
- The app serves static pages + API from the same server, so no extra config needed.

---

## Alternative (Static Only): Vercel
Vercel is great for static hosting but does not run the Express API in this setup.
Use this only if you remove `/api` endpoints or move them to serverless functions.

---

## Firebase Hosting (Advanced)
You can host the static site on Firebase Hosting and move API endpoints to Firebase Functions.
This requires additional refactor.
