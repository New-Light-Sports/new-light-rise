const form = document.getElementById("community-form");
const results = document.getElementById("community-results");
const statusEl = document.getElementById("community-status");

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
      <div class="result-stats">${badges}</div>
      ${
        user.highlightLinks?.length
          ? `<a class="ghost link-button" href="${user.highlightLinks[0]}" target="_blank" rel="noopener noreferrer">View highlight</a>`
          : ""
      }
      <div class="hero-actions">
        <button class="ghost connect-btn" data-name="${user.athleteName || "Athlete"}">Connect</button>
        <button class="primary follow-btn" data-name="${user.athleteName || "Athlete"}">Follow</button>
      </div>
    `;
    results.appendChild(card);
  });
};

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
