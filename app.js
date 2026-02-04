import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUtXhnJK7qomoH00sW68Bm5J4tvGAEhSo",
  authDomain: "new-light-rise.firebaseapp.com",
  projectId: "new-light-rise",
  storageBucket: "new-light-rise.appspot.com",
  appId: "1:279270123342:web:67e4a712cdfc5f2190a01f",
};

const signInBtn = document.getElementById("google-signin-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const statusEl = document.getElementById("auth-status");
const form = document.getElementById("college-form");
const resultBest = document.getElementById("result-best");
const resultGrid = document.getElementById("result-grid");
const evaluateBtn = document.getElementById("evaluate-btn");
const historyList = document.getElementById("history-list");
const bestHero = document.getElementById("best-hero");
const exportPdfBtn = document.getElementById("export-pdf-btn");
const printSummary = document.getElementById("print-summary");

const profileForm = document.getElementById("profile-form");
const profileStatus = document.getElementById("profile-status");
const profileEvals = document.getElementById("profile-evals");
const profileFollowers = document.getElementById("profile-followers");
const loadReportBtn = document.getElementById("load-report-btn");
const coachForm = document.getElementById("coach-form");
const coachStatus = document.getElementById("coach-status");
const coachHistory = document.getElementById("coach-history");
const trainingForm = document.getElementById("training-form");
const trainingStatus = document.getElementById("training-status");
const trainingResults = document.getElementById("training-results");
const trainingHistory = document.getElementById("training-history");
const videoForm = document.getElementById("video-upload-form");
const videoStatus = document.getElementById("video-status");
const videoList = document.getElementById("video-list");
const liveForm = document.getElementById("live-form");
const liveStatus = document.getElementById("live-status");
const liveResults = document.getElementById("live-results");
const liveHistory = document.getElementById("live-history");
const viewerCountEl = document.getElementById("viewer-count");
const liveStatusPill = document.getElementById("live-status-pill");
const goLiveBtn = document.getElementById("go-live-btn");
const chatMessages = document.getElementById("chat-messages");
const chatName = document.getElementById("chat-name");
const chatText = document.getElementById("chat-text");
const chatSend = document.getElementById("chat-send");
const editForm = document.getElementById("edit-form");
const editStatus = document.getElementById("edit-status");
const editHistory = document.getElementById("edit-history");
const previewEditBtn = document.getElementById("preview-edit");
const editVideo = document.getElementById("edit-video");
const editPreviewNote = document.getElementById("edit-preview-note");

let lastProfile = null;
let lastEvaluation = null;

let currentUser = null;

const setStatus = (text) => {
  if (!statusEl) return;
  statusEl.textContent = text;
};

const setAuthUI = (user) => {
  if (!signInBtn || !signOutBtn) return;
  if (user) {
    signOutBtn.style.display = "inline-flex";
    signInBtn.style.display = "none";
    signInBtn.disabled = true;
  } else {
    signOutBtn.style.display = "none";
    signInBtn.style.display = "inline-flex";
    signInBtn.disabled = false;
  }
};

setAuthUI(null);

if (exportPdfBtn) {
  exportPdfBtn.addEventListener("click", () => {
    if (window.html2pdf && printSummary) {
      if (lastEvaluation) {
        buildPrintSummary(lastEvaluation, lastProfile);
      } else if (resultBest?.textContent) {
        buildPrintSummary({ bestFit: { name: "Report" } }, lastProfile);
      } else {
        setStatus("Run an evaluation before exporting.");
        return;
      }
      printSummary.classList.add("active");
      const opt = {
        margin: 0.5,
        filename: "college-fit-report.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      };
      window
        .html2pdf()
        .set(opt)
        .from(printSummary)
        .save()
        .then(() => {
          printSummary.classList.remove("active");
        })
        .catch(() => {
          printSummary.classList.remove("active");
        });
    } else {
      window.print();
    }
  });
}

const isConfigured = Object.values(firebaseConfig).every(
  (value) => value && !value.startsWith("YOUR_")
);

let auth;
let db;
let provider;

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
} else {
  setStatus("Firebase config missing. Update app.js to enable sign-in.");
}

const buildPrintSummary = (data, profileOverride = null) => {
  if (!printSummary || !data?.bestFit) return;
  const meta = data.bestFit.meta || {};
  const profile = profileOverride || lastProfile || {};
  const name = profile.athleteName || "Athlete";
  const sport = profile.sport || "Sport";
  const position = profile.position || "Position";
  const gpa = profile.gpa || "N/A";
  const major = profile.major || "Undeclared";
  const locationProfile = profile.location || "N/A";
  const gradYear = profile.gradYear || "N/A";
  const otherFits = (data.otherFits || [])
    .filter(Boolean)
    .map((fit) => `<li>${fit.name || "College"} — ${fit.reason || ""}</li>`)
    .join("");
  printSummary.innerHTML = `
    <div class="pdf-header">
      <div class="pdf-logo">NLR</div>
      <div>
        <h1>College Fit Report</h1>
        <p>New Light Rise · ${new Date().toLocaleDateString()}</p>
      </div>
    </div>
    <h2>Athlete Profile</h2>
    <p><strong>${name}</strong> · ${sport} · ${position}</p>
    <p>GPA: ${gpa} · Major: ${major} · Grad Year: ${gradYear}</p>
    <p>Location: ${locationProfile}</p>
    <h2>Top Match</h2>
    <p><strong>${data.bestFit.name}</strong></p>
    <p>${data.bestFit.summary || ""}</p>
    <h2>Key Stats</h2>
    <p>Location: ${meta.location || "N/A"}</p>
    <p>Division: ${meta.division || "N/A"}</p>
    <p>Admission: ${
      typeof meta.admissionRate === "number"
        ? `${(meta.admissionRate * 100).toFixed(1)}%`
        : "N/A"
    }</p>
    <p>Graduation: ${
      typeof meta.graduationRate === "number"
        ? `${(meta.graduationRate * 100).toFixed(1)}%`
        : "N/A"
    }</p>
    <p>Tuition: ${
      meta.tuitionInState || meta.tuitionOutState
        ? `$${(meta.tuitionInState || meta.tuitionOutState).toLocaleString()}`
        : "N/A"
    }</p>
    <h2>Other Fits</h2>
    <ul>${otherFits || "<li>No additional matches.</li>"}</ul>
    <h2>Notes</h2>
    <p>${data.bestFit.reason || ""}</p>
    <p>${data.bestFit.recruitingTip || ""}</p>
  `;
};

const renderResults = (data, profileOverride = null) => {
  if (!data) return;
  if (resultBest) {
    resultBest.textContent = data.bestFit?.summary || "No results yet.";
  }
  if (resultGrid) {
    resultGrid.innerHTML = "";
  }
  if (bestHero) {
    bestHero.innerHTML = "";
  }

  const all = [data.bestFit, ...(data.otherFits || [])].filter(Boolean);
  if (data.bestFit && bestHero) {
    const meta = data.bestFit.meta || {};
    const admission =
      typeof meta.admissionRate === "number"
        ? `${(meta.admissionRate * 100).toFixed(1)}%`
        : "N/A";
    const grad =
      typeof meta.graduationRate === "number"
        ? `${(meta.graduationRate * 100).toFixed(1)}%`
        : "N/A";
    const tuition =
      meta.tuitionInState || meta.tuitionOutState
        ? `$${(meta.tuitionInState || meta.tuitionOutState).toLocaleString()}`
        : "N/A";
    const location = meta.location || "Location N/A";
    const division = meta.division || "Division N/A";
    const url = meta.url || "";

    bestHero.innerHTML = `
      <div class="hero-card">
        <div class="hero-left">
          <div class="result-logo">${(data.bestFit.name || "C")
            .slice(0, 2)
            .toUpperCase()}</div>
          <div>
            <div class="hero-label">Top Match</div>
            <div class="hero-title">${data.bestFit.name || "College"}</div>
            <div class="hero-sub">${location} · ${division}</div>
          </div>
        </div>
        <div class="hero-stats">
          <div class="stat-chip">Admission: ${admission}</div>
          <div class="stat-chip">Grad rate: ${grad}</div>
          <div class="stat-chip">Tuition: ${tuition}</div>
        </div>
        <div class="hero-actions">
          ${
            url
              ? `<a class="primary link-button" href="https://${url.replace(
                  /^https?:\/\//,
                  ""
                )}" target="_blank" rel="noopener noreferrer">Open website</a>`
              : ""
          }
        </div>
      </div>
    `;
  }
  buildPrintSummary(data, profileOverride);
  all.forEach((college) => {
    const card = document.createElement("div");
    card.className = "result-card";
    const meta = college.meta || {};
    const admission =
      typeof meta.admissionRate === "number"
        ? `${(meta.admissionRate * 100).toFixed(1)}%`
        : "N/A";
    const grad =
      typeof meta.graduationRate === "number"
        ? `${(meta.graduationRate * 100).toFixed(1)}%`
        : "N/A";
    const tuition =
      meta.tuitionInState || meta.tuitionOutState
        ? `$${(meta.tuitionInState || meta.tuitionOutState).toLocaleString()}`
        : "N/A";
    const location = meta.location || "Location N/A";
    const division = meta.division || "Division N/A";
    const url = meta.url || "";
    card.innerHTML = `
      <div class="result-header">
        <div class="result-logo">${(college.name || "C").slice(0, 2).toUpperCase()}</div>
        <div>
          <h4>${college.name || "College"}</h4>
          <div class="result-sub">${location} · ${division}</div>
        </div>
      </div>
      <div class="result-stats">
        <div class="stat-chip">Admission: ${admission}</div>
        <div class="stat-chip">Grad rate: ${grad}</div>
        <div class="stat-chip">Tuition: ${tuition}</div>
      </div>
      <p class="result-reason">${college.reason || "Strong overall fit."}</p>
      <p class="result-tip">${college.recruitingTip || ""}</p>
      ${
        url
          ? `<a class="ghost link-button result-link" href="https://${url.replace(
              /^https?:\/\//,
              ""
            )}" target="_blank" rel="noopener noreferrer">School website</a>`
          : ""
      }
    `;
    resultGrid.appendChild(card);
  });
};

const renderHistory = (items = [], target = historyList) => {
  if (!target) return;
  target.innerHTML = "";
  if (!items.length) {
    target.innerHTML =
      "<div class=\"history-item\"><p>No evaluations yet.</p></div>";
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "history-item";
    const bestFit = item?.result?.bestFit?.name || "College";
    const summary = item?.result?.bestFit?.summary || "Saved evaluation.";
    card.innerHTML = `<h4>${bestFit}</h4><p>${summary}</p>`;
    target.appendChild(card);
  });
};

const fetchHistory = async () => {
  if (!currentUser) return;
  try {
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/evaluations", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (response.ok) {
      renderHistory(data.evaluations || [], historyList);
      renderHistory(data.evaluations || [], profileEvals);
    }
  } catch (error) {
    console.warn("History fetch failed:", error.message);
  }
};

const fetchFollowerCount = async () => {
  if (!currentUser || !profileFollowers) return;
  try {
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/followers", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (response.ok) {
      profileFollowers.textContent = String(data.followerCount || 0);
    }
  } catch (error) {
    console.warn("Follower count fetch failed:", error.message);
  }
};

const fetchProfile = async () => {
  if (!currentUser || !db) return null;
  const docRef = doc(db, "users", currentUser.uid);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return snapshot.data()?.profile || null;
};

const loadLatestEvaluation = async () => {
  if (!currentUser) return;
  try {
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/evaluations", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Failed to load evaluations");
    }
    const latest = data.evaluations?.[0];
    if (latest?.result) {
      lastEvaluation = latest.result;
      if (!lastProfile) {
        lastProfile = await fetchProfile();
      }
      renderResults(latest.result, lastProfile);
    }
  } catch (error) {
    if (profileStatus) {
      profileStatus.textContent = `Report load failed: ${error.message}`;
    }
  }
};

if (signInBtn) {
  signInBtn.addEventListener("click", async () => {
    if (!auth) {
      setStatus("Firebase config missing. Update app.js to enable sign-in.");
      return;
    }
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      setStatus(`Sign in failed: ${error.message}`);
    }
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    if (!auth) {
      setStatus("Firebase config missing. Update app.js to enable sign-in.");
      return;
    }
    try {
      await signOut(auth);
    } catch (error) {
      setStatus(`Sign out failed: ${error.message}`);
    }
  });
}

if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
  if (user) {
    setStatus(`Signed in as ${user.displayName || user.email}`);
    setAuthUI(user);
    fetchHistory();
    if (profileForm) {
      loadProfile();
    }
    if (profileFollowers) {
      fetchFollowerCount();
    }
    if (loadReportBtn) {
      loadLatestEvaluation();
    }
    if (coachForm) {
      fetchCoachHistory();
    }
    if (trainingForm) {
      fetchTrainingHistory();
    }
    if (videoForm) {
      fetchVideos();
    }
    if (liveForm) {
      fetchLiveStreams();
    }
    if (liveForm) {
      loadChat();
    }
    if (editForm) {
      fetchEditHistory();
    }
  } else {
    setStatus("Not signed in");
    setAuthUI(null);
  }
});
}

if (loadReportBtn) {
  loadReportBtn.addEventListener("click", () => {
    loadLatestEvaluation();
  });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!db || !auth) {
      setStatus("Firebase config missing. Update app.js to enable sign-in.");
      return;
    }

    if (!currentUser) {
      setStatus("Please sign in with Google to run the evaluation.");
      return;
    }

    if (evaluateBtn) {
      evaluateBtn.disabled = true;
      evaluateBtn.textContent = "Evaluating...";
    }

    try {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    lastProfile = payload;

    payload.stats = [
      {
        label: payload.stat1Name,
        value: payload.stat1Value,
      },
      {
        label: payload.stat2Name,
        value: payload.stat2Value,
      },
      {
        label: payload.stat3Name,
        value: payload.stat3Value,
      },
    ].filter((item) => item.label || item.value);

    payload.highlightLinks = payload.highlightLinks
      ? payload.highlightLinks.split(",").map((link) => link.trim())
      : [];

    await setDoc(
      doc(db, "users", currentUser.uid),
      {
        profile: {
          ...payload,
          stats: payload.stats,
          highlightLinks: payload.highlightLinks,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    console.log("Getting ID token");
    const token = await currentUser.getIdToken();
    console.log("Got ID token");

    console.log("Submitting college-fit request");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("/api/college-fit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = null;
    }
    if (!response.ok) {
      const message = data?.error || text || "Request failed";
      throw new Error(`(${response.status}) ${message}`);
    }

    lastEvaluation = data;
    renderResults(data);
    setStatus("Evaluation complete.");
    fetchHistory();
  } catch (error) {
    console.error("College-fit request failed:", error);
    setStatus(`Evaluation failed: ${error.message}`);
  } finally {
    if (evaluateBtn) {
      evaluateBtn.disabled = false;
      evaluateBtn.textContent = "Run AI College Fit";
    }
  }
  });
}

const loadProfile = async () => {
  if (!profileForm || !currentUser || !db) return;
  try {
    const docRef = doc(db, "users", currentUser.uid);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return;
    const profile = snapshot.data()?.profile || {};
    lastProfile = profile;
    Object.entries(profile).forEach(([key, value]) => {
      const field = profileForm.querySelector(`[name="${key}"]`);
      if (field) {
        field.value = Array.isArray(value) ? value.join(", ") : value;
      }
    });
  } catch (error) {
    if (profileStatus) {
      profileStatus.textContent = `Load failed: ${error.message}`;
    }
  }
};

if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || !db) {
      if (profileStatus) {
        profileStatus.textContent = "Sign in to save your profile.";
      }
      return;
    }
    try {
      const formData = new FormData(profileForm);
      const payload = Object.fromEntries(formData.entries());
      payload.highlightLinks = payload.highlightLinks
        ? payload.highlightLinks.split(",").map((link) => link.trim())
        : [];
      await setDoc(
        doc(db, "users", currentUser.uid),
        { profile: payload, updatedAt: serverTimestamp() },
        { merge: true }
      );
      lastProfile = payload;
      if (profileStatus) {
        profileStatus.textContent = "Profile saved.";
      }
    } catch (error) {
      if (profileStatus) {
        profileStatus.textContent = `Save failed: ${error.message}`;
      }
    }
  });
}

const initStars = () => {
  const starBlocks = document.querySelectorAll(".stars[data-field]");
  starBlocks.forEach((block) => {
    if (block.dataset.ready) return;
    block.dataset.ready = "true";
    const field = block.dataset.field;
    const input = coachForm?.querySelector(`input[name="${field}"]`);
    for (let i = 1; i <= 5; i += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", `${field} rating ${i}`);
      btn.addEventListener("click", () => {
        if (input) input.value = String(i);
        [...block.children].forEach((child, idx) => {
          child.classList.toggle("active", idx < i);
        });
      });
      block.appendChild(btn);
    }
  });
};

const fetchCoachHistory = async () => {
  if (!currentUser) return;
  try {
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/coach-evaluations", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Failed to load history");
    renderHistory(data.evaluations || [], coachHistory);
  } catch (error) {
    if (coachStatus) {
      coachStatus.textContent = `Load failed: ${error.message}`;
    }
  }
};

if (coachForm) {
  initStars();
  coachForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || !db) {
      if (coachStatus) {
        coachStatus.textContent = "Sign in to save the evaluation.";
      }
      return;
    }
    try {
      const formData = new FormData(coachForm);
      const payload = Object.fromEntries(formData.entries());
      payload.createdAt = new Date().toISOString();
      await setDoc(
        doc(db, "users", currentUser.uid, "coachEvaluations", `${Date.now()}`),
        payload
      );
      if (coachStatus) {
        coachStatus.textContent = "Coach evaluation saved.";
      }
      fetchCoachHistory();
    } catch (error) {
      if (coachStatus) {
        coachStatus.textContent = `Save failed: ${error.message}`;
      }
    }
  });
}

const renderTrainingResults = (items = []) => {
  if (!trainingResults) return;
  trainingResults.innerHTML = "";
  if (!items.length) {
    trainingResults.innerHTML =
      "<div class=\"trainer-card\"><p>No matches yet. Submit a request.</p></div>";
    return;
  }
  items.forEach((trainer) => {
    const card = document.createElement("div");
    card.className = "trainer-card";
    card.innerHTML = `
      <h4>${trainer.name}</h4>
      <p>${trainer.city}, ${trainer.state} · ${trainer.sport}</p>
      <p>Specialty: ${trainer.specialty}</p>
      <p>Rate: $${trainer.rate}/session · Availability: ${trainer.availability}</p>
    `;
    trainingResults.appendChild(card);
  });
};

const fetchTrainingHistory = async () => {
  if (!currentUser) return;
  try {
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/training-requests", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Failed to load history");
    renderHistory(data.requests || [], trainingHistory);
  } catch (error) {
    if (trainingStatus) {
      trainingStatus.textContent = `Load failed: ${error.message}`;
    }
  }
};

if (trainingForm) {
  trainingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) {
      if (trainingStatus) {
        trainingStatus.textContent = "Sign in to request training.";
      }
      return;
    }
    try {
      const formData = new FormData(trainingForm);
      const payload = Object.fromEntries(formData.entries());
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/training-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Match failed");
      renderTrainingResults(data.matches || []);
      if (trainingStatus) {
        trainingStatus.textContent = "Matches updated.";
      }
      fetchTrainingHistory();
    } catch (error) {
      if (trainingStatus) {
        trainingStatus.textContent = `Request failed: ${error.message}`;
      }
    }
  });
}

const renderVideos = (items = []) => {
  if (!videoList) return;
  videoList.innerHTML = "";
  if (!items.length) {
    videoList.innerHTML =
      "<div class=\"trainer-card\"><p>No uploads yet.</p></div>";
    return;
  }
  items.forEach((video) => {
    const card = document.createElement("div");
    card.className = "trainer-card";
    const url = video.url || "";
    const embedUrl = (() => {
      try {
        const u = new URL(url);
        if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
          return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
        }
        if (u.hostname.includes("youtu.be")) {
          return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
        }
        if (u.hostname.includes("vimeo.com")) {
          return `https://player.vimeo.com/video/${u.pathname.split("/").pop()}`;
        }
      } catch (_) {
        return "";
      }
      return "";
    })();
    card.innerHTML = `
      <h4>${video.title}</h4>
      <p>${video.description || ""}</p>
      ${
        embedUrl
          ? `<iframe class="video-embed" src="${embedUrl}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`
          : `<a class="ghost link-button" href="${url}" target="_blank" rel="noopener noreferrer">Open video</a>`
      }
    `;
    videoList.appendChild(card);
  });
};

const fetchVideos = async () => {
  if (!currentUser || !db) return;
  try {
    const docRef = doc(db, "users", currentUser.uid);
    const snapshot = await getDoc(docRef);
    const videos = snapshot.data()?.videos || [];
    renderVideos(videos);
  } catch (error) {
    if (videoStatus) {
      videoStatus.textContent = `Load failed: ${error.message}`;
    }
  }
};

if (videoForm) {
  videoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || !db) {
      if (videoStatus) {
        videoStatus.textContent = "Sign in to upload videos.";
      }
      return;
    }
    try {
      const formData = new FormData(videoForm);
      const title = formData.get("title")?.toString().trim();
      const description = formData.get("description")?.toString().trim();
      const url = formData.get("videoUrl")?.toString().trim();
      if (!url) {
        throw new Error("Paste a video link.");
      }
      const docRef = doc(db, "users", currentUser.uid);
      const snapshot = await getDoc(docRef);
      const videos = snapshot.data()?.videos || [];
      const next = [
        {
          title: title || "Video",
          description,
          url,
          createdAt: new Date().toISOString(),
        },
        ...videos,
      ];
      await setDoc(
        docRef,
        { videos: next, updatedAt: serverTimestamp() },
        { merge: true }
      );
      if (videoStatus) {
        videoStatus.textContent = "Video saved.";
      }
      videoForm.reset();
      renderVideos(next);
    } catch (error) {
      if (videoStatus) {
        videoStatus.textContent = `Upload failed: ${error.message}`;
      }
    }
  });
}

const renderLiveStreams = (items = []) => {
  if (!liveResults) return;
  liveResults.innerHTML = "";
  if (!items.length) {
    liveResults.innerHTML =
      "<div class=\"trainer-card\"><p>No live streams yet.</p></div>";
    return;
  }
  items.forEach((stream) => {
    const card = document.createElement("div");
    card.className = "trainer-card";
    const url = stream.liveUrl || "";
    const embedUrl = (() => {
      try {
        const u = new URL(url);
        if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
          return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
        }
        if (u.hostname.includes("youtu.be")) {
          return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
        }
        if (u.hostname.includes("twitch.tv")) {
          return `https://player.twitch.tv/?channel=${u.pathname.split("/").pop()}&parent=localhost`;
        }
      } catch (_) {
        return "";
      }
      return "";
    })();
    card.innerHTML = `
      <h4>${stream.title || "Live Stream"}</h4>
      <p>${stream.host || ""} ${stream.status ? `· ${stream.status}` : ""}</p>
      ${
        embedUrl
          ? `<iframe class="video-embed" src="${embedUrl}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`
          : `<a class="ghost link-button" href="${url}" target="_blank" rel="noopener noreferrer">Open stream</a>`
      }
    `;
    liveResults.appendChild(card);
  });
};

const fetchLiveStreams = async () => {
  if (!currentUser || !db) return;
  try {
    const docRef = doc(db, "users", currentUser.uid);
    const snapshot = await getDoc(docRef);
    const liveStreams = snapshot.data()?.liveStreams || [];
    renderLiveStreams(liveStreams);
    renderHistory(liveStreams, liveHistory);
    const latest = liveStreams[0];
    if (liveStatusPill) {
      liveStatusPill.textContent = latest?.status || "Offline";
    }
  } catch (error) {
    if (liveStatus) {
      liveStatus.textContent = `Load failed: ${error.message}`;
    }
  }
};

if (liveForm) {
  liveForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || !db) {
      if (liveStatus) {
        liveStatus.textContent = "Sign in to add a live stream.";
      }
      return;
    }
    try {
      const formData = new FormData(liveForm);
      const payload = Object.fromEntries(formData.entries());
      const docRef = doc(db, "users", currentUser.uid);
      const snapshot = await getDoc(docRef);
      const liveStreams = snapshot.data()?.liveStreams || [];
      const next = [
        {
          title: payload.title,
          host: payload.host,
          liveUrl: payload.liveUrl,
          status: payload.status || "Live",
          scheduleDate: payload.scheduleDate || "",
          scheduleTime: payload.scheduleTime || "",
          createdAt: new Date().toISOString(),
        },
        ...liveStreams,
      ];
      await setDoc(
        docRef,
        { liveStreams: next, updatedAt: serverTimestamp() },
        { merge: true }
      );
      if (liveStatus) {
        liveStatus.textContent = "Live stream saved.";
      }
      liveForm.reset();
      renderLiveStreams(next);
      renderHistory(next, liveHistory);
      if (liveStatusPill) {
        liveStatusPill.textContent = payload.status || "Live";
      }
    } catch (error) {
      if (liveStatus) {
        liveStatus.textContent = `Save failed: ${error.message}`;
      }
    }
  });
}

if (goLiveBtn) {
  goLiveBtn.addEventListener("click", () => {
    if (liveStatusPill) liveStatusPill.textContent = "Live";
  });
}

if (viewerCountEl) {
  let viewers = Math.floor(Math.random() * 200 + 30);
  viewerCountEl.textContent = viewers.toString();
  setInterval(() => {
    const delta = Math.floor(Math.random() * 12 - 4);
    viewers = Math.max(0, viewers + delta);
    viewerCountEl.textContent = viewers.toString();
  }, 3000);
}

const renderChatMessage = (message) => {
  if (!chatMessages) return;
  const line = document.createElement("div");
  line.className = "chat-message";
  line.innerHTML = `<strong>${message.name}</strong>: ${message.text}`;
  chatMessages.appendChild(line);
  chatMessages.scrollTop = chatMessages.scrollHeight;
};

if (chatSend) {
  chatSend.addEventListener("click", async () => {
    if (!currentUser || !db) {
      if (liveStatus) {
        liveStatus.textContent = "Sign in to chat.";
      }
      return;
    }
    const name = chatName?.value?.trim() || "Guest";
    const text = chatText?.value?.trim();
    if (!text) return;
    const docRef = doc(db, "users", currentUser.uid);
    const snapshot = await getDoc(docRef);
    const chat = snapshot.data()?.liveChat || [];
    const next = [
      { name, text, createdAt: new Date().toISOString() },
      ...chat,
    ].slice(0, 30);
    await setDoc(docRef, { liveChat: next }, { merge: true });
    renderChatMessage({ name, text });
    chatText.value = "";
  });
}

const loadChat = async () => {
  if (!currentUser || !db || !chatMessages) return;
  const docRef = doc(db, "users", currentUser.uid);
  const snapshot = await getDoc(docRef);
  const chat = (snapshot.data()?.liveChat || []).slice().reverse();
  chatMessages.innerHTML = "";
  chat.forEach(renderChatMessage);
};

const fetchEditHistory = async () => {
  if (!currentUser || !db) return;
  try {
    const docRef = doc(db, "users", currentUser.uid);
    const snapshot = await getDoc(docRef);
    const edits = snapshot.data()?.editPlans || [];
    renderHistory(edits, editHistory);
  } catch (error) {
    if (editStatus) {
      editStatus.textContent = `Load failed: ${error.message}`;
    }
  }
};

const previewCut = (url, startTime, endTime) => {
  if (!editVideo) return;
  editVideo.src = url;
  editVideo.currentTime = startTime || 0;
  editVideo.play();
  if (endTime && endTime > startTime) {
    setTimeout(() => {
      editVideo.pause();
    }, (endTime - startTime) * 1000);
  }
};

if (previewEditBtn) {
  previewEditBtn.addEventListener("click", () => {
    const formData = new FormData(editForm);
    const url = formData.get("videoUrl")?.toString().trim();
    const startTime = Number(formData.get("startTime")) || 0;
    const endTime = Number(formData.get("endTime")) || 0;
    if (!url) {
      if (editStatus) editStatus.textContent = "Paste a video link first.";
      return;
    }
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      if (editPreviewNote) {
        editPreviewNote.textContent =
          "YouTube links can’t be previewed here. Use a direct MP4 URL.";
      }
      return;
    }
    if (editPreviewNote) editPreviewNote.textContent = "";
    previewCut(url, startTime, endTime);
  });
}

if (editForm) {
  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || !db) {
      if (editStatus) {
        editStatus.textContent = "Sign in to save edit plans.";
      }
      return;
    }
    try {
      const formData = new FormData(editForm);
      const payload = Object.fromEntries(formData.entries());
      payload.createdAt = new Date().toISOString();
      const docRef = doc(db, "users", currentUser.uid);
      const snapshot = await getDoc(docRef);
      const editPlans = snapshot.data()?.editPlans || [];
      const next = [payload, ...editPlans].slice(0, 20);
      await setDoc(
        docRef,
        { editPlans: next, updatedAt: serverTimestamp() },
        { merge: true }
      );
      if (editStatus) {
        editStatus.textContent = "Edit plan saved.";
      }
      editForm.reset();
      renderHistory(next, editHistory);
    } catch (error) {
      if (editStatus) {
        editStatus.textContent = `Save failed: ${error.message}`;
      }
    }
  });
}
