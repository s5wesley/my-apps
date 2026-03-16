# Wesley Mbarga Institute of Learning Student Portal

Student portal for registering and verifying students with a Docker-ready Node backend.

## Features
- Poster-inspired UI based on the provided visual reference
- Student registration with name, email, and department
- Department options: `Dev`, `Stagging`, `Production`
- Registration lookup by email
- Recent entries panel backed by the backend API
- DynamoDB support through environment configuration
- File storage fallback for local development only
- Container-ready runtime for Docker deployment

## Deployment model
- Frontend and backend are served by the same Node process.
- In AWS, set `STUDENTS_TABLE_NAME` to use DynamoDB.
- If `STUDENTS_TABLE_NAME` is not set, the app falls back to `data/students.json`, which is not appropriate for production cloud use.

## Environment variables
- `PORT`: container port, usually `3000`
- `AWS_REGION`: for example `us-east-1`
- `STUDENTS_TABLE_NAME`: DynamoDB table name for student records

## DynamoDB table shape
- Table name: your choice, for example `wesley-mbarga-students`
- Partition key: `email` as `String`

## Run locally
1. Open a terminal in `/Users/mac/Documents/New project/LAFABAH`
2. Run `npm install`
3. Run `npm start`
4. Visit `http://127.0.0.1:3000`

## Run with Docker
1. Build the image: `docker build -t wesleymbarga/student-portal:latest .`
2. Create `.env` from `.env.example`
3. Start the container:
   - `docker run -d --name student-portal --env-file .env -p 3000:3000 wesleymbarga/student-portal:latest`
4. Open `http://localhost:3000`

## Run with Docker Compose
1. Create `.env` from `.env.example`
2. Run `docker compose up -d --build`
3. Open `http://localhost:3000`

## Push to Docker Hub
1. Log in: `docker login`
2. Build: `docker build -t wesleymbarga/student-portal:latest .`
3. Push: `docker push wesleymbarga/student-portal:latest`

## Notes
- For cloud deployment, use DynamoDB instead of the JSON file.
- The backend exposes `GET /health`, `GET /api/students`, and `POST /api/students`.
