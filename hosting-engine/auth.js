
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLIC_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment configuration.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

export async function requireAuth(request, reply) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return reply.code(401).send({
      error: "Authentication required"
    });
  }

  const token = authorization.slice(7);

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return reply.code(401).send({
      error: "Invalid or expired login"
    });
  }

  request.user = data.user;
    }
