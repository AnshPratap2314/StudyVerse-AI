const { spawn } = require("child_process");
const { once } = require("events");

const base = process.env.TEST_URL || "http://localhost:5050";
let child = null;

async function request(path, options = {}) {
  return fetch(base + path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
}

async function waitForHealth(timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await request("/api/health");
      if (response.status === 200) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  return false;
}

async function ensureServer() {
  try {
    const response = await request("/api/health");
    if (response.status === 200) return false;
  } catch {}

  console.log(`ℹ️ Backend is not running at ${base}; starting a temporary smoke-test server...`);
  child = spawn(process.execPath, ["server.cjs"], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(new URL(base).port || 5050) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", data => process.stdout.write(`[server] ${data}`));
  child.stderr.on("data", data => process.stderr.write(`[server] ${data}`));
  const ready = await waitForHealth();
  if (!ready) throw new Error("Backend could not start. Check dependencies with `npm install` and inspect the server output above.");
  return true;
}

(async () => {
  let failed = 0;
  try {
    await ensureServer();
    const checks = [
      ["health is public", "/api/health", { method: "GET" }, r => r.status === 200],
      ["frontend is served", "/", { method: "GET" }, r => r.status === 200],
      ["protected AI status rejects anonymous", "/api/ai/status", { method: "GET" }, r => [401,503].includes(r.status)],
      ["protected AI chat rejects anonymous", "/api/ai/chat", { method: "POST", body: "{}" }, r => [401,503].includes(r.status)],
      ["protected AI task rejects anonymous", "/api/ai/task", { method: "POST", body: "{}" }, r => [401,503].includes(r.status)],
      ["protected documents rejects anonymous", "/api/documents", { method: "GET" }, r => [401,503].includes(r.status)],
      ["auth me rejects anonymous", "/api/auth/me", { method: "GET" }, r => [401,503].includes(r.status)],
      ["protected productivity rejects anonymous", "/api/productivity/health", { method: "GET" }, r => [401,503].includes(r.status)],
      ["protected integration status rejects anonymous", "/api/integrations/status", { method: "GET" }, r => [401,503].includes(r.status)],
      ["protected room join rejects anonymous", "/api/rooms/UNKNOWN/join", { method: "POST", body: "{}" }, r => [401,503].includes(r.status)],
      ["unknown API route returns JSON 404", "/api/does-not-exist", { method: "GET" }, r => r.status === 404]
    ];
    for (const [name, path, options, predicate] of checks) {
      try {
        const response = await request(path, options);
        const ok = predicate(response);
        console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${response.status}`);
        if (!ok) failed++;
      } catch (error) { console.log(`FAIL ${name}: ${error.message}`); failed++; }
    }
  } catch (error) {
    console.error(`FAIL smoke bootstrap: ${error.message}`);
    failed++;
  } finally {
    if (child) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 3000))]);
      if (!child.killed) child.kill("SIGKILL");
    }
  }
  process.exitCode = failed ? 1 : 0;
})();
