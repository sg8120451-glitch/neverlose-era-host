import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

export function createApp(env = process.env) {
  const app = Fastify({ logger: true, bodyLimit: 16 * 1024 });
  const token = env.EXECUTION_WORKER_TOKEN || "";
  const enabled = env.EXECUTION_ENABLED === "true";

  app.register(helmet);
  app.register(rateLimit, { max: 30, timeWindow: "1 minute" });

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
    executionEnabled: false,
    executionConfigured: enabled
  }));

  app.post("/v1/projects/:action", async (request, reply) => {
    if (!authorized(request)) return reply.code(401).send({ error: "Authentication required" });

    const allowed = new Set(["start", "stop", "restart", "status", "logs"]);
    const action = request.params.action;
    if (!allowed.has(action)) return reply.code(404).send({ error: "Unknown project action" });

    const body = request.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return reply.code(400).send({ error: "A JSON project payload is required." });
    }

    const isUuid = (value) =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    if (!isUuid(body.projectId) || !isUuid(body.ownerId)) {
      return reply.code(400).send({ error: "Valid project and owner UUIDs are required." });
    }
    if (body.runtime !== "nodejs") {
      return reply.code(400).send({ error: "Only the Node.js runtime is supported." });
    }
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 100) {
      return reply.code(400).send({ error: "Project name is invalid." });
    }

    if (action === "start" || action === "restart") {
      let archive;
      let expectedOrigin = "";
      try {
        archive = new URL(body.archiveUrl);
        expectedOrigin = new URL(env.SUPABASE_URL).origin;
      } catch {
        return reply.code(400).send({ error: "A valid project archive URL is required." });
      }

      if (
        archive.protocol !== "https:" ||
        archive.origin !== expectedOrigin ||
        archive.username ||
        archive.password ||
        archive.hash ||
        !archive.pathname.startsWith("/storage/v1/object/sign/bot-uploads/") ||
        !archive.searchParams.has("token")
      ) {
        return reply.code(400).send({ error: "Project archive URL is not a valid signed URL from the configured storage bucket." });
      }
    }

    if (!enabled) {
      return reply.code(503).send({
        error: "Execution is disabled until isolated container execution is installed and security-tested."
      });
    }

    // Fail closed until a reviewed container runtime and isolation policy are installed.
    return reply.code(503).send({
      error: "No execution runtime is installed. This worker will not run uploaded code."
    });
  });

  return app;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const app = createApp();
  const port = Number(process.env.PORT || 3100);
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}
