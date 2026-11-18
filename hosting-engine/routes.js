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
        .select("id, name, status, runtime, created_at")
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

  // Be explicit: uploads are supported, but arbitrary project execution
  // is not enabled until an isolated execution worker is configured.
  app.get(
    "/api/hosting/capabilities",
    { preHandler: requireAuth },
    async () => ({
      success: true,
      uploadEnabled: true,
      executionEnabled: false,
      supportedRuntimes: ["nodejs"],
      executionWorkerConnected: false,
      message: "Projects can be uploaded and listed. Bot execution will be enabled after a secure isolated worker is connected."
    })
  );
}
