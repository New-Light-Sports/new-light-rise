# New Light Rise MVP

Responsive web app prototype with Google sign-in (Firebase Auth), Firestore user profiles, and a free college-fit evaluation endpoint powered by College Scorecard data and local heuristics.

## Setup

1. Install dependencies.

```bash
npm install
```

2. Make sure you are running Node 18+ (for built-in `fetch`).

3. Create a `.env` file.

```bash
cp .env.example .env
```

4. Add your College Scorecard API key in `.env`.

```
SCORECARD_API_KEY=your_key_here
```

5. Configure Firebase Auth.

- Create a Firebase project.
- Enable **Google** as a sign-in provider.
- Add a **Web App** and copy the config.
- Replace the `firebaseConfig` values in `app.js`.
- Add `http://localhost:3000` as an authorized domain in Firebase Auth settings.

6. Configure Firebase Admin (server token verification).

- In Firebase, create a service account and download the JSON key.
- Set `FIREBASE_SERVICE_ACCOUNT` to the absolute path of the JSON file.
- Set `FIREBASE_PROJECT_ID` to your Firebase project id.

7. Start the server.

```bash
npm start
```

Open `http://localhost:3000`.

### Routes

- `/` Home
- `/profile`
- `/videos`
- `/live`
- `/editing`
- `/training`
- `/coach`
- `/college` (AI + Google sign-in)

## Notes

- The AI evaluation endpoint is `/api/college-fit` and expects JSON from the form.
- Google sign-in runs in the browser and sends an ID token with requests.
- The server verifies the Firebase ID token before calling the AI endpoint.
- College data is pulled from the U.S. Department of Education College Scorecard API (IPEDS-backed).
- Optional: provide an NCAA data JSON file via `NCAA_DATA_PATH` to include athletics divisions.
  - Expected format: `[{\"school\": \"University Name\", \"division\": \"Division I\"}]`
  - You can build this file from a CSV export using the script below.

## NCAA Import Script

Convert a CSV (or JSON) export into the normalized NCAA JSON format.

```bash
npm run import:ncaa -- --input /path/to/ncaa.csv --output ./data/ncaa-data.json
```

Then set `NCAA_DATA_PATH=./data/ncaa-data.json` in your `.env`.

## Data Sources

- College Scorecard API (U.S. Department of Education). Use an API key from the official docs.
- IPEDS is the underlying federal data source for many Scorecard fields.
- NCAA Directory or NCAA membership datasets can be exported and transformed into the JSON format above.
