const registrationForm = document.getElementById("registrationForm");
const lookupForm = document.getElementById("lookupForm");
const registrationMessage = document.getElementById("registrationMessage");
const lookupResult = document.getElementById("lookupResult");
const recordsList = document.getElementById("recordsList");
const storageKey = "wesley-mbarga-students";

function readStudents() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveStudents(students) {
  localStorage.setItem(storageKey, JSON.stringify(students));
}

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

function renderRecords() {
  const students = readStudents().slice().reverse();

  if (!students.length) {
    recordsList.innerHTML =
      '<div class="empty-state">No students have been registered in this browser yet.</div>';
    return;
  }

  recordsList.innerHTML = students
    .map(
      (student) => `
        <article class="record-card">
          <strong>${student.name}</strong>
          <span>${student.email}</span>
          <div class="meta-row">
            <span class="pill">${student.department}</span>
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
      <strong>${student.name}</strong>
      <span>${student.email}</span>
      <div class="meta-row">
        <span class="pill">${student.department}</span>
      </div>
      <span>Registration confirmed on ${formatDate(student.registeredAt)}</span>
    </article>
  `;
}

if (registrationForm) {
  registrationForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(registrationForm);
    const student = {
      name: String(formData.get("name")).trim(),
      email: normalizeEmail(String(formData.get("email"))),
      department: String(formData.get("department")).trim(),
      registeredAt: new Date().toISOString(),
    };

    const students = readStudents();
    const existingIndex = students.findIndex(
      (entry) => normalizeEmail(entry.email) === student.email
    );

    if (existingIndex >= 0) {
      students[existingIndex] = { ...students[existingIndex], ...student };
      registrationMessage.textContent =
        "This email was already registered. The student record has been updated.";
    } else {
      students.push(student);
      registrationMessage.textContent =
        "Student registered successfully. You can now verify the record in the lookup section.";
    }

    saveStudents(students);
    renderRecords();
    renderLookup(student);
    registrationForm.reset();
  });
}

if (lookupForm) {
  lookupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const lookupEmail = normalizeEmail(
      String(new FormData(lookupForm).get("lookupEmail") || "")
    );
    const students = readStudents();
    const foundStudent = students.find(
      (student) => normalizeEmail(student.email) === lookupEmail
    );
    renderLookup(foundStudent);
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

renderRecords();
