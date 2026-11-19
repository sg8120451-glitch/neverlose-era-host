import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "./auth.js";

export default async function routes(app) {
  app.get(
    "/api/me",
    { preHandler: requireAuth },
    async (request) => ({
      success: true,
      user: {
        id: request.user.id,
        email: request.user.email
      }
    })
  );

  // Return only projects owned by the authenticated user.
  app.get(
    "/api/projects",
    { preHandler: requireAuth },
    async (request, reply) => {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLIC_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${request.accessToken}`
            }
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      const { data, error } = await supabase
        .from("bots")
        .select("id, name, status, runtime, created_at, storage_path")
        .eq("owner_id", request.user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        request.log.error({ err: error }, "Could not load user projects");
        return reply.code(502).send({
          error: "Could not load projects"
        });
      }

      return {
        success: true,
        projects: data ?? []
      };
    }
  );

  // Execution is delegated to a separately isolated worker; this API never runs ZIP contents.
  const workerConfigured = () =>
    Boolean(process.env.EXECUTION_WORKER_URL && process.env.EXECUTION_WORKER_TOKEN);

  async function workerRequest(path, payload) {
    if (!workerConfigured()) {
      const error = new Error("Secure execution worker is not connected yet.");
      error.statusCode = 503;
      throw error;
    }

    // Never send the shared worker token over an insecure or malformed URL.
    let workerBase;
    try {
      workerBase = new URL(process.env.EXECUTION_WORKER_URL);
    } catch {
      const error = new Error("Execution worker URL is invalid.");
      error.statusCode = 503;
      throw error;
    }
    if (
      workerBase.protocol !== "https:" ||
      workerBase.username ||
      workerBase.password ||
      workerBase.search ||
      workerBase.hash
    ) {
      const error = new Error("Execution worker must use a clean HTTPS URL.");
      error.statusCode = 503;
      throw error;
    }

    const response = await fetch(new URL(path, workerBase), {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.EXECUTION_WORKER_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || "Execution worker request failed.");
      error.statusCode = response.status >= 500 ? 502 : response.status;
      throw error;
    }
    return result;
  }

  async function projectAction(request, reply, action) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_PUBLIC_KEY,
        {
          global: { headers: { Authorization: "Bearer " + request.accessToken } },
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        }
      );
      const { data: project, error } = await supabase
        .from("bots")
        .select("id, owner_id, name, runtime, storage_path")
        .eq("id", request.params.id)
        .eq("owner_id", request.user.id)
        .maybeSingle();

      if (error) {
        request.log.error({ err: error }, "Could not verify project ownership");
        return reply.code(502).send({ error: "Could not verify project" });
      }
      if (!project) return reply.code(404).send({ error: "Project not found" });
      if (project.runtime !== "nodejs") {
        return reply.code(400).send({ error: "Only Node.js projects are currently supported." });
      }

      let archiveUrl;
      if (action === "start" || action === "restart") {
        if (!project.storage_path) {
          return reply.code(400).send({ error: "Project archive is missing." });
        }
        const { data, error: storageError } = await supabase.storage
          .from("bot-uploads")
          .createSignedUrl(project.storage_path, 300);
        if (storageError || !data?.signedUrl) {
          request.log.error({ err: storageError }, "Could not create temporary project URL");
          return reply.code(502).send({ error: "Could not prepare project archive." });
        }
        archiveUrl = data.signedUrl;
      }

      const result = await workerRequest("/v1/projects/" + action, {
        projectId: project.id,
        ownerId: project.owner_id,
        name: project.name,
        runtime: project.runtime,
        archiveUrl
      });
      return { success: true, ...result };
    } catch (error) {
      request.log.error({ err: error }, "Execution worker action failed");
      return reply.code(error.statusCode || 502).send({ error: error.message });
    }
  }

  for (const action of ["start", "stop", "restart", "status", "logs"]) {
    app.post(
      "/api/projects/:id/" + action,
      { preHandler: requireAuth },
      (request, reply) => projectAction(request, reply, action)
    );
  }

  async function checkWorkerHealth() {
    if (!workerConfigured()) return { connected: false, executionEnabled: false };
    try {
      const workerBase = new URL(process.env.EXECUTION_WORKER_URL);
      if (
        workerBase.protocol !== "https:" ||
        workerBase.username ||
        workerBase.password ||
        workerBase.search ||
        workerBase.hash
      ) return { connected: false, executionEnabled: false };

      const response = await fetch(new URL("/health", workerBase), {
        method: "GET",
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) return { connected: false, executionEnabled: false };
      const health = await response.json();
      return {
        connected: health?.status === "healthy" &&
          health?.service === "neverlose-era-execution-worker",
        executionEnabled: health?.executionEnabled === true
      };
    } catch {
      return { connected: false, executionEnabled: false };
    }
  }

  app.get(
    "/api/hosting/capabilities",
    { preHandler: requireAuth },
    async () => {
      const worker = await checkWorkerHealth();
      return {
        success: true,
        uploadEnabled: true,
        executionEnabled: worker.connected && worker.executionEnabled,
        supportedRuntimes: ["nodejs"],
        executionWorkerConnected: worker.connected,
        message: worker.connected && worker.executionEnabled
          ? "Isolated execution worker is healthy and enabled."
          : worker.connected
            ? "Worker is reachable, but execution is safely disabled."
            : "Uploads and project listing are ready. No healthy execution worker is connected."
      };
    }
  );
  
  // Public AI support endpoint. The provider key is read only from server env.
  app.post(
    "/api/ai-chat",
    {
      config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
      bodyLimit: 12000
    },
    async (request, reply) => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return reply.code(503).send({ error: "AI support is being configured. Please contact Discord support for now." });
      }

      const incoming = request.body?.messages;
      if (!Array.isArray(incoming) || incoming.length < 1 || incoming.length > 12) {
        return reply.code(400).send({ error: "Please send a valid chat message." });
      }

      const messages = [];
      for (const item of incoming) {
        if (!item || !["user", "assistant"].includes(item.role) ||
            typeof item.content !== "string" || !item.content.trim() ||
            item.content.length > 2000) {
          return reply.code(400).send({ error: "A chat message is invalid or too long." });
        }
        messages.push({ role: item.role, content: item.content.trim() });
      }
      if (messages[messages.length - 1].role !== "user") {
        return reply.code(400).send({ error: "The latest message must be a question." });
      }

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are the NEVERLOSE ERA website support assistant. Help visitors understand this Discord bot hosting platform, its account and Google sign-in flow, dashboard, Node.js bot project ZIP uploads, private storage, plans, and support options. Be friendly, concise, and honest. Do not claim a feature is available unless confirmed by the visitor's information or the platform description. The site currently supports account sign-in, project ownership, ZIP upload, download and delete; secure bot execution may not yet be enabled. For account-specific or billing issues, direct the visitor to the official Discord support invite https://discord.gg/z9ty5674ss. Never request passwords, OAuth codes, bot tokens, API keys, or other secrets. Do not claim you can access accounts, change settings, or deploy bots. If unsure, say so and point to Discord support."
              },
              ...messages
            ],
            temperature: 0.4,
            max_tokens: 500
          }),
          signal: AbortSignal.timeout(20000)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          request.log.error({ status: response.status, providerError: result.error?.type || result.error?.code }, "AI provider request failed");
          return reply.code(502).send({ error: "The AI assistant could not answer right now. Please try again later." });
        }
        const answer = result.choices?.[0]?.message?.content?.trim();
        if (!answer) return reply.code(502).send({ error: "The AI assistant returned an empty answer. Please try again." });
        return { success: true, answer };
      } catch (error) {
        request.log.error({ err: error }, "AI support request failed");
        return reply.code(502).send({ error: "Could not connect to the AI assistant. Please try again later." });
      }
    }
  );
}
