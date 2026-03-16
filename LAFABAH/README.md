# Wesley Mbarga Institute of Learning Student Portal

Frontend-only student portal for registering and verifying students.

## Features
- Poster-inspired UI based on the provided visual reference
- Student registration with name, email, and department
- Department options: `Dev`, `Stagging`, `Production`
- Registration lookup by email
- Recent entries panel backed by browser `localStorage`

## Run locally
1. Open [index.html](/Users/mac/Documents/New project/LAFABAH/index.html) in a browser, or
2. Serve the folder locally:
   - `python3 -m http.server 8080`
   - Visit `http://localhost:8080`

## Notes
- This version stores records in the browser only.
- If you want multi-user persistence, the next step is adding a backend and database.
