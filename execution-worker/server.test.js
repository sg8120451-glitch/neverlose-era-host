import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./server.js";

const env = {
  EXECUTION_WORKER_TOKEN: "test-only-worker-token",
  EXECUTION_ENABLED: "false",
  SUPABASE_URL: "https://example.supabase.co"
};
const payload = {
  projectId: "123e4567-e89b-12d3-a456-426614174000",
  ownerId: "123e4567-e89b-12d3-a456-426614174001",
  name: "Test bot",
  runtime: "nodejs",
  archiveUrl: "https://example.supabase.co/storage/v1/object/sign/bot-uploads/user/test.zip?token=temporary"
};

async function withApp(run) {
  const app = createApp(env);
  try {
    await app.ready();
    await run(app);
  } finally {
    await app.close();
  }
}

test("health endpoint reports execution remains disabled", async () => {
  await withApp(async (app) => {
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().executionEnabled, false);
  });
});

test("project actions require the shared bearer token", async () => {
  await withApp(async (app) => {
    const response = await app.inject({ method: "POST", url: "/v1/projects/start", payload });
    assert.equal(response.statusCode, 401);
  });
});

test("unknown project actions are rejected", async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: "POST", url: "/v1/projects/launch",
      headers: { authorization: "Bearer " + env.EXECUTION_WORKER_TOKEN }, payload
    });
    assert.equal(response.statusCode, 404);
  });
});

test("malformed project IDs are rejected", async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: "POST", url: "/v1/projects/start",
      headers: { authorization: "Bearer " + env.EXECUTION_WORKER_TOKEN },
      payload: { ...payload, projectId: "../../etc/passwd" }
    });
    assert.equal(response.statusCode, 400);
  });
});

test("archive URLs outside the configured signed storage path are rejected", async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: "POST", url: "/v1/projects/start",
      headers: { authorization: "Bearer " + env.EXECUTION_WORKER_TOKEN },
      payload: { ...payload, archiveUrl: "https://attacker.example/archive.zip" }
    });
    assert.equal(response.statusCode, 400);
  });
});

test("valid requests still fail closed while no isolated runtime exists", async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: "POST", url: "/v1/projects/start",
      headers: { authorization: "Bearer " + env.EXECUTION_WORKER_TOKEN }, payload
    });
    assert.equal(response.statusCode, 503);
    assert.match(response.json().error, /Execution is disabled/);
  });
});
