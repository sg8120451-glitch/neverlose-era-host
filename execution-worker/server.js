import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";

const app = Fastify({ logger: true, bodyLimit: 16 * 1024 });
const port = Number(process.env.PORT || 3100);
const token = process.env.EXECUTION_WORKER_TOKEN || "";
const enabled = process.env.EXECUTION_ENABLED === "true";

await app.register(helmet);
await app.register(rateLimit, { max: 30, timeWindow: "1 minute" });

function authorized(request) {
  const header = request.headers.authorization || "";
  if (!token || !header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

app.get("/health", async () => ({
  status: "healthy",
  service: "neverlose-era-execution-worker",
  executionEnabled: enabled
}));

app.post("/v1/projects/:action", async (request, reply) => {
  if (!authorized(request)) return reply.code(401).send({ error: "Authentication required" });

  const allowed = new Set(["start", "stop", "restart", "status", "logs"]);
  const action = request.params.action;
  if (!allowed.has(action)) return reply.code(404).send({ error: "Unknown project action" });

  const body = request.body || {};
  const validId = (value) =>
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(value);

  if (!validId(body.projectId) || !validId(body.ownerId)) {
    return reply.code(400).send({ error: "A valid projectId and ownerId are required." });
  }
  if (body.runtime !== "nodejs") {
    return reply.code(400).send({ error: "Only the Node.js runtime is supported." });
  }
  if (typeof body.name !== "string" || body.name.length > 100) {
    return reply.code(400).send({ error: "Project name is invalid." });
  }

  if (action === "start" || action === "restart") {
    let archive;
    try {
      archive = new URL(body.archiveUrl);
    } catch {
      return reply.code(400).send({ error: "A valid project archive URL is required." });
    }
    const expectedOrigin = process.env.SUPABASE_URL
      ? new URL(process.env.SUPABASE_URL).origin
      : "";
    if (
      archive.protocol !== "https:" ||
      !expectedOrigin ||
      archive.origin !== expectedOrigin ||
      !archive.pathname.includes("/storage/v1/object/sign/bot-uploads/")
    ) {
      return reply.code(400).send({ error: "Project archive URL is not from the configured storage bucket." });
    }
  }

  if (!enabled) {
    return reply.code(503).send({
      error: "Execution is disabled until isolated container execution is installed and security-tested."
    });
  }

  // Fail closed: a container runtime must be installed and reviewed before this endpoint can execute code.
  return reply.code(503).send({ error: "No execution runtime is installed. This worker will not run uploaded code." });
});

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
