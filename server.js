import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import admin from "firebase-admin";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const log = (message) => {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  try {
    fs.appendFileSync("/tmp/nlr.log", `${line}\n`);
  } catch (_) {
    // Ignore log write failures
  }
};

app.use((req, _res, next) => {
  log(`${req.method} ${req.url}`);
  next();
});

const routeMap = {
  "/": "index.html",
  "/profile": "profile.html",
  "/community": "community.html",
  "/videos": "videos.html",
  "/live": "live.html",
  "/editing": "editing.html",
  "/training": "training.html",
  "/coach": "coach.html",
  "/college": "college.html",
  "/report": "report.html",
};

Object.entries(routeMap).forEach(([route, file]) => {
  app.get(route, (_, res) => {
    res.sendFile(path.join(__dirname, file));
  });
});


const scorecardBase = "https://api.data.gov/ed/collegescorecard/v1/schools";

let ncaaData = [];
if (process.env.NCAA_DATA_PATH) {
  try {
    const raw = fs.readFileSync(process.env.NCAA_DATA_PATH, "utf-8");
    ncaaData = JSON.parse(raw);
  } catch (error) {
    console.warn("Could not load NCAA data:", error.message);
  }
}

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const serviceAccount = raw.trim().startsWith("{")
      ? JSON.parse(raw)
      : JSON.parse(fs.readFileSync(raw, "utf-8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
  } catch (error) {
    console.warn("Firebase admin init failed:", error.message);
  }
}

const firestore =
  admin.apps.length > 0 ? admin.firestore() : null;

const parseNumber = (value) => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  return cleaned ? Number(cleaned) : null;
};

const normalizeState = (input = "") => {
  const match = input.trim().toUpperCase().match(/\\b[A-Z]{2}\\b/);
  return match ? match[0] : "";
};

const fetchScorecardData = async (athlete) => {
  if (!process.env.SCORECARD_API_KEY) {
    return [];
  }

  const state = normalizeState(athlete.location);
  const params = new URLSearchParams({
    api_key: process.env.SCORECARD_API_KEY,
    per_page: "50",
    fields: [
      "school.name",
      "school.city",
      "school.state",
      "school.school_url",
      "latest.student.size",
      "latest.admissions.admission_rate.overall",
      "latest.cost.tuition.in_state",
      "latest.cost.tuition.out_of_state",
      "latest.completion.rate_suppressed.overall",
    ].join(","),
  });

  params.set("school.degrees_awarded.predominant", "3");
  if (state) {
    params.set("school.state", state);
  }

  const budgetNum = parseNumber(athlete.budget);
  if (budgetNum) {
    params.set("latest.cost.tuition.in_state__lte", String(budgetNum));
  }

  const url = `${scorecardBase}?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      console.warn("Scorecard fetch failed:", response.status);
      return [];
    }
    const data = await response.json();
    return data?.results || [];
  } catch (error) {
    console.warn("Scorecard fetch error:", error.message);
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

const matchNcaaDivision = (schoolName) => {
  if (!Array.isArray(ncaaData) || !schoolName) return null;
  const hit = ncaaData.find((item) =>
    item?.school?.toLowerCase().includes(schoolName.toLowerCase())
  );
  return hit ? hit.division : null;
};

const budgetMatch = (school, budget) => {
  if (!budget) return 0;
  const budgetNum = parseNumber(budget);
  if (!budgetNum) return 0;
  const inState = school?.["latest.cost.tuition.in_state"];
  const outState = school?.["latest.cost.tuition.out_of_state"];
  const tuition = inState ?? outState;
  if (!tuition) return 0;
  return tuition <= budgetNum ? 1 : -1;
};

const majorMatch = (school, major) => {
  if (!major) return 0;
  const name = String(school?.["school.name"] || "").toLowerCase();
  const majorText = String(major).toLowerCase();
  if (/(engineering|computer|software|tech|stem)/.test(majorText)) {
    return /(tech|institute|polytechnic|engineering)/.test(name) ? 1 : 0.2;
  }
  if (/(business|finance|accounting|marketing)/.test(majorText)) {
    return /(business|commerce|management)/.test(name) ? 1 : 0.2;
  }
  if (/(biology|health|nursing|medical|pre-med)/.test(majorText)) {
    return /(health|medical|nursing|medicine)/.test(name) ? 1 : 0.2;
  }
  return 0.1;
};

const scoreCollege = (school, athlete) => {
  let score = 0;
  score += majorMatch(school, athlete.major) * 30;
  score += budgetMatch(school, athlete.budget) * 20;

  const admission = school?.["latest.admissions.admission_rate.overall"];
  if (typeof admission === "number") {
    score += admission > 0.6 ? 10 : admission < 0.2 ? -5 : 5;
  }

  const completion = school?.["latest.completion.rate_suppressed.overall"];
  if (typeof completion === "number") {
    score += completion > 0.7 ? 10 : completion > 0.5 ? 5 : 0;
  }

  const size = school?.["latest.student.size"];
  if (typeof size === "number") {
    score += size > 10000 ? 5 : 2;
  }

  return score;
};

const trainerData = [
  {
    name: "Coach Harper",
    city: "Atlanta",
    state: "GA",
    sport: "Basketball",
    specialty: "Explosiveness, shooting mechanics",
    rate: 65,
    availability: "Weekdays",
  },
  {
    name: "Coach Rivera",
    city: "Marietta",
    state: "GA",
    sport: "Football",
    specialty: "Speed + agility, film review",
    rate: 70,
    availability: "Evenings",
  },
  {
    name: "Coach Patel",
    city: "Decatur",
    state: "GA",
    sport: "Soccer",
    specialty: "Footwork, conditioning",
    rate: 55,
    availability: "Weekends",
  },
  {
    name: "Coach Brooks",
    city: "Nashville",
    state: "TN",
    sport: "Basketball",
    specialty: "Ball handling, court vision",
    rate: 60,
    availability: "Weekends",
  },
  {
    name: "Coach Nguyen",
    city: "Charlotte",
    state: "NC",
    sport: "Track",
    specialty: "Sprint form, starts",
    rate: 50,
    availability: "Mornings",
  },
  {
    name: "Coach Allen",
    city: "Orlando",
    state: "FL",
    sport: "Baseball",
    specialty: "Pitching, arm care",
    rate: 75,
    availability: "Weekdays",
  },
];

const scoreTrainer = (trainer, request) => {
  let score = 0;
  const sport = String(request.sport || "").toLowerCase();
  const goal = String(request.goal || "").toLowerCase();
  const state = String(request.state || "").toUpperCase();
  const budget = parseNumber(request.budget);

  if (trainer.state === state) score += 30;
  if (trainer.sport.toLowerCase().includes(sport)) score += 40;
  if (goal && trainer.specialty.toLowerCase().includes(goal)) score += 15;
  if (budget && trainer.rate <= budget) score += 10;
  return score;
};

const buildRecommendation = (school, athlete, rank) => {
  const name = school?.["school.name"] || "College";
  const admission = school?.["latest.admissions.admission_rate.overall"];
  const completion = school?.["latest.completion.rate_suppressed.overall"];
  const division = school?.athleticsDivision || "Division I/II/III";
  const city = school?.["school.city"] || "";
  const state = school?.["school.state"] || "";
  const location = [city, state].filter(Boolean).join(", ");
  const tuitionIn = school?.["latest.cost.tuition.in_state"];
  const tuitionOut = school?.["latest.cost.tuition.out_of_state"];
  const schoolUrl = school?.["school.school_url"] || "";
  const major = athlete?.major ? `Major fit: ${athlete.major}.` : "";
  const admissionText =
    typeof admission === "number"
      ? `Admission rate: ${(admission * 100).toFixed(1)}%.`
      : "Admission rate varies.";
  const completionText =
    typeof completion === "number"
      ? `Graduation rate: ${(completion * 100).toFixed(1)}%.`
      : "";

  const summary = `${name} is a ${division} program${location ? ` in ${location}` : ""}. ${major} ${admissionText}`.trim();

  const reason = `Ranked #${rank} by fit score. ${completionText}`.trim();
  const recruitingTip =
    "Send a highlight reel, academic transcript, and 2–3 key stats aligned to their program needs.";

  return {
    name,
    score: school?.fitScore ?? 0,
    summary,
    reason,
    recruitingTip,
    meta: {
      location,
      division,
      admissionRate: admission ?? null,
      graduationRate: completion ?? null,
      tuitionInState: tuitionIn ?? null,
      tuitionOutState: tuitionOut ?? null,
      url: schoolUrl,
    },
  };
};

app.post("/api/college-fit", async (req, res) => {
  try {
    const requestStart = Date.now();
    if (!admin.apps.length || !firestore) {
      return res
        .status(500)
        .json({ error: "Firebase admin not configured" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const athlete = req.body || {};
    log("College-fit request received");
    const scorecardResults = await fetchScorecardData(athlete);
    log(
      `Scorecard results: ${scorecardResults.length} schools in ${Date.now() - requestStart}ms`
    );
    const enrichedResults = scorecardResults.map((school) => ({
      ...school,
      athleticsDivision: matchNcaaDivision(school?.["school.name"]),
    }));

    const scoredResults = enrichedResults.map((school) => ({
      ...school,
      fitScore: scoreCollege(school, athlete),
    }));

    const filteredResults = scoredResults
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 12);
    log(
      `Filtered results: ${filteredResults.length} schools in ${Date.now() - requestStart}ms`
    );

    const bestFitSchool = filteredResults[0];
    const otherFitSchools = filteredResults.slice(1, 5);
    const parsed = {
      bestFit: bestFitSchool
        ? buildRecommendation(bestFitSchool, athlete, 1)
        : {
            name: "No match found",
            score: 0,
            summary: "No colleges matched the filters. Try adjusting inputs.",
            reason: "No data returned from Scorecard.",
            recruitingTip: "Broaden location or budget preferences.",
          },
      otherFits: otherFitSchools.map((school, index) =>
        buildRecommendation(school, athlete, index + 2)
      ),
    };

    await firestore
      .collection("users")
      .doc(decodedToken.uid)
      .collection("evaluations")
      .add({
        athlete,
        result: parsed,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    log(`College-fit completed in ${Date.now() - requestStart}ms`);
    return res.status(200).json(parsed);
  } catch (error) {
    log(`College-fit error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/evaluations", async (req, res) => {
  try {
    if (!admin.apps.length || !firestore) {
      log("Evaluations request blocked: Firebase admin not configured");
      return res
        .status(500)
        .json({ error: "Firebase admin not configured" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      log("Evaluations request missing auth token");
      return res.status(401).json({ error: "Missing auth token" });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      log(`Evaluations invalid token: ${error.message}`);
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const snapshot = await firestore
      .collection("users")
      .doc(decodedToken.uid)
      .collection("evaluations")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const evaluations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    log(`Evaluations returned: ${evaluations.length}`);
    return res.status(200).json({ evaluations });
  } catch (error) {
    log(`Evaluations error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/coach-evaluations", async (req, res) => {
  try {
    if (!admin.apps.length || !firestore) {
      return res
        .status(500)
        .json({ error: "Firebase admin not configured" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const snapshot = await firestore
      .collection("users")
      .doc(decodedToken.uid)
      .collection("coachEvaluations")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const evaluations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ evaluations });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/training-match", async (req, res) => {
  try {
    if (!admin.apps.length || !firestore) {
      return res
        .status(500)
        .json({ error: "Firebase admin not configured" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const request = req.body || {};
    const scored = trainerData
      .map((trainer) => ({
        ...trainer,
        score: scoreTrainer(trainer, request),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    await firestore
      .collection("users")
      .doc(decodedToken.uid)
      .collection("trainingRequests")
      .add({
        request,
        matches: scored,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return res.status(200).json({ matches: scored });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/training-requests", async (req, res) => {
  try {
    if (!admin.apps.length || !firestore) {
      return res
        .status(500)
        .json({ error: "Firebase admin not configured" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const snapshot = await firestore
      .collection("users")
      .doc(decodedToken.uid)
      .collection("trainingRequests")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ requests });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    if (!admin.apps.length || !firestore) {
      return res
        .status(500)
        .json({ error: "Firebase admin not configured" });
    }

    const q = String(req.query.q || "").toLowerCase();
    const sportFilter = String(req.query.sport || "").toLowerCase();
    const gradFilter = String(req.query.gradYear || "").toLowerCase();
    const majorFilter = String(req.query.major || "").toLowerCase();
    const snapshot = await firestore
      .collection("users")
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();

    const users = snapshot.docs
      .map((doc) => doc.data()?.profile)
      .filter(Boolean)
      .map((profile) => ({
        athleteName: profile.athleteName || "",
        sport: profile.sport || "",
        position: profile.position || "",
        location: profile.location || "",
        major: profile.major || "",
        gpa: profile.gpa || "",
        gradYear: profile.gradYear || "",
        highlightLinks: profile.highlightLinks || [],
        badges: [
          profile.gpa ? `GPA ${profile.gpa}` : null,
          profile.gradYear ? `Class of ${profile.gradYear}` : null,
          profile.major ? profile.major : null,
        ].filter(Boolean),
      }))
      .filter((profile) => {
        const haystack = `${profile.athleteName} ${profile.sport} ${profile.position} ${profile.location} ${profile.major}`.toLowerCase();
        if (sportFilter && !profile.sport.toLowerCase().includes(sportFilter)) {
          return false;
        }
        if (gradFilter && !profile.gradYear.toLowerCase().includes(gradFilter)) {
          return false;
        }
        if (majorFilter && !profile.major.toLowerCase().includes(majorFilter)) {
          return false;
        }
        if (!q) return true;
        return haystack.includes(q);
      });

    return res.status(200).json({ users });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  log(`Server running at http://localhost:${port}`);
});
