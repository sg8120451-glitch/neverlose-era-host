import test from "node:test";
import assert from "node:assert/strict";
import { assertProviderAdapter, normalizeProviderStatus } from "../providers/adapter-contract.js";
import { createSimulationAdapter } from "../providers/simulation-adapter.js";

const project = { id: "project-test-1", owner_id: "owner-test-1" };

test("simulation adapter implements the provider contract", () => {
  assert.doesNotThrow(() => assertProviderAdapter(createSimulationAdapter()));
});

test("simulation lifecycle is explicitly marked as simulated", async () => {
  const adapter = createSimulationAdapter();
  const started = await adapter.start(project);
  assert.equal(started.status, "running");
  assert.equal(started.simulated, true);
  assert.equal(started.provider, "simulation");

  const stopped = await adapter.stop(project);
  assert.equal(stopped.status, "stopped");
  assert.equal(stopped.simulated, true);
});

test("simulation logs clearly state that no code was executed", async () => {
  const adapter = createSimulationAdapter();
  const result = await adapter.logs(project);
  assert.equal(result.simulated, true);
  assert.match(result.lines[0].message, /No bot code has been executed/);
});

test("unknown provider statuses normalize safely", () => {
  assert.equal(normalizeProviderStatus("unexpected"), "unknown");
});
