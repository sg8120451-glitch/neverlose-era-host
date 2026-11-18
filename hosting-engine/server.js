
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import routes from "./routes.js";

const app = Fastify({
  logger: true,
  trustProxy: true
});

const PORT = Number(process.env.PORT || 3000);
const WEBSITE_ORIGIN = process.env.WEBSITE_ORIGIN;

await app.register(helmet);

await app.register(cors, {
  origin: WEBSITE_ORIGIN ? [WEBSITE_ORIGIN] : false
});

await app.register(rateLimit, {
  max: 60,
  timeWindow: "1 minute"
});

app.get("/", async () => ({
  name: "NEVERLOSE ERA Hosting Engine",
  status: "online",
  version: "0.1.0"
}));

app.get("/health", async () => ({
  status: "healthy",
  service: "hosting-engine"
}));

// Register authenticated API routes
await app.register(routes);

try {
  await app.listen({
    port: PORT,
    host: "0.0.0.0"
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
