const registrationForm = document.getElementById("registrationForm");
const lookupForm = document.getElementById("lookupForm");
const registrationMessage = document.getElementById("registrationMessage");
const lookupResult = document.getElementById("lookupResult");
const recordsList = document.getElementById("recordsList");

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderRecords(students) {
  const items = students.slice().reverse();

  if (!items.length) {
    recordsList.innerHTML =
      '<div class="empty-state">No students have been registered in the backend yet.</div>';
    return;
  }

  recordsList.innerHTML = items
    .map(
      (student) => `
        <article class="record-card">
          <strong>${escapeHtml(student.name)}</strong>
          <span>${escapeHtml(student.email)}</span>
          <div class="meta-row">
            <span class="pill">${escapeHtml(student.department)}</span>
          </div>
          <span>Registered ${formatDate(student.registeredAt)}</span>
        </article>
      `
    )
    .join("");
}

function renderLookup(student) {
  if (!student) {
    lookupResult.innerHTML = `
      <p>No student record was found for that email address.</p>
      <p>Please register first if you have not joined yet.</p>
    `;
    return;
  }

  lookupResult.innerHTML = `
    <article class="result-card">
      <strong>${escapeHtml(student.name)}</strong>
      <span>${escapeHtml(student.email)}</span>
      <div class="meta-row">
        <span class="pill">${escapeHtml(student.department)}</span>
      </div>
      <span>Registration confirmed on ${formatDate(student.registeredAt)}</span>
    </article>
  `;
}

async function fetchStudents() {
  const response = await fetch("/api/students");

  if (!response.ok) {
    throw new Error("Unable to fetch students.");
  }

  const data = await response.json();
  return data.students || [];
}

async function refreshRecords() {
  const students = await fetchStudents();
  renderRecords(students);
}

if (registrationForm) {
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registrationForm);
    const student = {
      name: String(formData.get("name")).trim(),
      email: normalizeEmail(String(formData.get("email"))),
      department: String(formData.get("department")).trim(),
    };

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(student),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      registrationMessage.textContent = data.message;
      renderLookup(data.student);
      await refreshRecords();
      registrationForm.reset();
    } catch (error) {
      registrationMessage.textContent = error.message;
    }
  });
}

if (lookupForm) {
  lookupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const lookupEmail = normalizeEmail(
      String(new FormData(lookupForm).get("lookupEmail") || "")
    );

    try {
      const response = await fetch(`/api/students?email=${encodeURIComponent(lookupEmail)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Lookup failed.");
      }

      renderLookup(data.student);
    } catch (error) {
      lookupResult.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    }
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

refreshRecords().catch(() => {
  recordsList.innerHTML =
    '<div class="empty-state">Unable to load students. Start the backend server and refresh.</div>';
});
