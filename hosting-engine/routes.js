
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
}
