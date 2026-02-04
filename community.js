import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUtXhnJK7qomoH00sW68Bm5J4tvGAEhSo",
  authDomain: "new-light-rise.firebaseapp.com",
  projectId: "new-light-rise",
  storageBucket: "new-light-rise.appspot.com",
  appId: "1:279270123342:web:67e4a712cdfc5f2190a01f",
};

const form = document.getElementById("community-form");
const results = document.getElementById("community-results");
const statusEl = document.getElementById("community-status");
const authStatus = document.getElementById("community-auth");
const signInBtn = document.getElementById("community-signin-btn");
const signOutBtn = document.getElementById("community-signout-btn");

let currentUser = null;

const setAuthStatus = (text) => {
  if (!authStatus) return;
  authStatus.textContent = text;
};

const render = (items = []) => {
  if (!results) return;
  results.innerHTML = "";
  if (!items.length) {
    results.innerHTML = "<div class=\"trainer-card\"><p>No matches found.</p></div>";
    return;
  }
  items.forEach((user) => {
    const card = document.createElement("div");
    card.className = "trainer-card";
    const badges =
      user.badges?.map((b) => `<span class="stat-chip">${b}</span>`).join("") ||
      "";
    card.innerHTML = `
      <h4>${user.athleteName || "Athlete"}</h4>
      <p>${user.sport || "Sport"} · ${user.position || "Position"}</p>
      <p>${user.location || "Location"}</p>
      <p>Major: ${user.major || "N/A"} · GPA: ${user.gpa || "N/A"} · Grad: ${
        user.gradYear || "N/A"
      }</p>
      <p class="follower-count" data-followers="${user.followerCount ?? 0}">Followers: ${user.followerCount ?? 0}</p>
      <div class="result-stats">${badges}</div>
      ${
        user.highlightLinks?.length
          ? `<a class="ghost link-button" href="${user.highlightLinks[0]}" target="_blank" rel="noopener noreferrer">View highlight</a>`
          : ""
      }
      <div class="hero-actions">
        <a class="ghost link-button" href="/user?uid=${user.uid}">View profile</a>
        <button class="primary follow-btn" data-uid="${user.uid}" data-name="${user.athleteName || "Athlete"}">Follow</button>
      </div>
    `;
    results.appendChild(card);
  });
};

const followUser = async (targetUid, targetName, buttonEl) => {
  statusEl.textContent = "Following...";
  try {
    if (!currentUser) {
      statusEl.textContent = "Sign in to follow athletes.";
      return;
    }
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/follow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUid }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Follow failed");
    statusEl.textContent = data.alreadyFollowing
      ? `Already following ${targetName}.`
      : `Now following ${targetName}.`;
    if (!data.alreadyFollowing && buttonEl) {
      buttonEl.textContent = "Following";
      const card = buttonEl.closest(".trainer-card");
      const countEl = card?.querySelector(".follower-count");
      if (countEl) {
        const current = Number(countEl.getAttribute("data-followers") || 0);
        const next = current + 1;
        countEl.setAttribute("data-followers", String(next));
        countEl.textContent = `Followers: ${next}`;
      }
    }
  } catch (error) {
    statusEl.textContent = error.message;
  }
};

if (results) {
  results.addEventListener("click", (event) => {
    const btn = event.target.closest(".follow-btn");
    if (!btn) return;
    const uid = btn.getAttribute("data-uid");
    const name = btn.getAttribute("data-name") || "athlete";
    if (uid) followUser(uid, name, btn);
  });
}

const search = async (query, sport, gradYear, major) => {
  if (!results) return;
  statusEl.textContent = "Searching...";
  try {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sport) params.set("sport", sport);
    if (gradYear) params.set("gradYear", gradYear);
    if (major) params.set("major", major);
    const response = await fetch(`/api/users?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Search failed");
    render(data.users || []);
    statusEl.textContent = "";
  } catch (error) {
    statusEl.textContent = error.message;
  }
};

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const query = formData.get("query")?.toString().trim();
    const sport = formData.get("sport")?.toString().trim();
    const gradYear = formData.get("gradYear")?.toString().trim();
    const major = formData.get("major")?.toString().trim();
    search(query, sport, gradYear, major);
  });
}

const isConfigured = Object.values(firebaseConfig).every(
  (value) => value && value !== "YOUR_API_KEY"
);

let auth = null;

if (isConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

const setAuthUI = (user) => {
  if (!signInBtn || !signOutBtn) return;
  if (user) {
    signInBtn.style.display = "none";
    signOutBtn.style.display = "inline-flex";
  } else {
    signInBtn.style.display = "inline-flex";
    signOutBtn.style.display = "none";
  }
};

if (signInBtn) {
  signInBtn.addEventListener("click", async () => {
    if (!auth) {
      setAuthStatus("Firebase config missing. Update community.js to enable sign-in.");
      return;
    }
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      setAuthStatus(`Sign in failed: ${error.message}`);
    }
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      setAuthStatus(`Sign out failed: ${error.message}`);
    }
  });
}

if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      setAuthStatus(`Signed in as ${user.displayName || user.email}`);
      setAuthUI(user);
    } else {
      setAuthStatus("Not signed in");
      setAuthUI(null);
    }
  });
} else {
  setAuthUI(null);
}
