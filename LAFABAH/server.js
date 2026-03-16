const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const publicDir = __dirname;
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "students.json");
const awsRegion = process.env.AWS_REGION || "us-east-1";
const dynamoTableName = process.env.STUDENTS_TABLE_NAME || "";
const storageMode = dynamoTableName ? "dynamodb" : "file";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

let documentClient = null;

if (storageMode === "dynamodb") {
  const dynamoClient = new DynamoDBClient({ region: awsRegion });
  documentClient = DynamoDBDocumentClient.from(dynamoClient);
}

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch (error) {
    await fs.writeFile(dataFile, "[]\n", "utf8");
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeStudent(student) {
  return {
    name: String(student.name || "").trim(),
    email: normalizeEmail(student.email),
    department: String(student.department || "").trim(),
    registeredAt: String(student.registeredAt || new Date().toISOString()),
  };
}

async function readStudentsFromFile() {
  await ensureDataFile();
  const raw = await fs.readFile(dataFile, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeStudentsToFile(students) {
  await ensureDataFile();
  await fs.writeFile(dataFile, `${JSON.stringify(students, null, 2)}\n`, "utf8");
}

async function listStudents() {
  if (storageMode === "dynamodb") {
    const result = await documentClient.send(
      new ScanCommand({
        TableName: dynamoTableName,
      })
    );

    return (result.Items || [])
      .map(sanitizeStudent)
      .sort((left, right) => new Date(left.registeredAt) - new Date(right.registeredAt));
  }

  return readStudentsFromFile();
}

async function getStudentByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (storageMode === "dynamodb") {
    const result = await documentClient.send(
      new GetCommand({
        TableName: dynamoTableName,
        Key: { email: normalizedEmail },
      })
    );

    return result.Item ? sanitizeStudent(result.Item) : null;
  }

  const students = await readStudentsFromFile();
  return students.find((entry) => normalizeEmail(entry.email) === normalizedEmail) || null;
}

async function upsertStudent(student) {
  const nextStudent = sanitizeStudent(student);

  if (storageMode === "dynamodb") {
    const existingStudent = await getStudentByEmail(nextStudent.email);
    const persistedStudent = existingStudent
      ? { ...existingStudent, ...nextStudent }
      : nextStudent;

    await documentClient.send(
      new PutCommand({
        TableName: dynamoTableName,
        Item: persistedStudent,
      })
    );

    return {
      student: persistedStudent,
      updated: Boolean(existingStudent),
    };
  }

  const students = await readStudentsFromFile();
  const existingIndex = students.findIndex(
    (entry) => normalizeEmail(entry.email) === nextStudent.email
  );
  const updated = existingIndex >= 0;

  if (updated) {
    students[existingIndex] = {
      ...students[existingIndex],
      ...nextStudent,
    };
  } else {
    students.push(nextStudent);
  }

  await writeStudentsToFile(students);

  return {
    student: updated ? students[existingIndex] : nextStudent,
    updated,
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function parseJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, {
      ok: true,
      storageMode,
      region: awsRegion,
      tableName: dynamoTableName || null,
    });
  }

  if (request.method === "GET" && url.pathname === "/api/students") {
    const email = normalizeEmail(url.searchParams.get("email"));

    if (email) {
      const student = await getStudentByEmail(email);
      return sendJson(response, 200, { student });
    }

    const students = await listStudents();
    return sendJson(response, 200, { students });
  }

  if (request.method === "POST" && url.pathname === "/api/students") {
    const body = await parseJsonBody(request);
    const name = String(body.name || "").trim();
    const email = normalizeEmail(body.email);
    const department = String(body.department || "").trim();

    if (!name || !email || !department) {
      return sendJson(response, 400, {
        error: "Name, email, and department are required.",
      });
    }

    const allowedDepartments = new Set(["Dev", "Stagging", "Production"]);

    if (!allowedDepartments.has(department)) {
      return sendJson(response, 400, {
        error: "Department must be Dev, Stagging, or Production.",
      });
    }

    const result = await upsertStudent({
      name,
      email,
      department,
      registeredAt: new Date().toISOString(),
    });

    return sendJson(response, result.updated ? 200 : 201, {
      student: result.student,
      message: result.updated
        ? "Student record updated successfully."
        : "Student registered successfully.",
    });
  }

  sendJson(response, 404, { error: "Not found." });
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
    });
    response.end(file);
  } catch (error) {
    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end("File not found.");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, {
      error: "Internal server error.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

server.listen(port, host, async () => {
  if (storageMode === "file") {
    await ensureDataFile();
  }

  console.log(
    `Student portal server running at http://${host}:${port} using ${storageMode} storage`
  );
});
