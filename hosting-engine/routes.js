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

  app.get(
    "/api/hosting/capabilities",
    { preHandler: requireAuth },
    async () => ({
      success: true,
      uploadEnabled: true,
      executionEnabled: workerConfigured(),
      supportedRuntimes: ["nodejs"],
      executionWorkerConnected: workerConfigured(),
      message: workerConfigured()
        ? "Execution worker is configured. Project actions are available."
        : "Uploads and project listing are ready. Configure a secure isolated worker to enable execution."
    })
  );
}
