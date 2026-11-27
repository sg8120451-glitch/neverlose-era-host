# NEVERLOSE ERA Bot Dashboard

## Files
- `bot-dashboard.html`: Sapphire-inspired server configuration UI.
- `supabase/bot-dashboard.sql`: per-user settings table and RLS policies.

## Required setup
1. In Supabase Authentication > Providers, enable **Discord** and configure the Discord OAuth client ID and secret.
2. In Discord Developer Portal > OAuth2, add the Supabase callback URL shown by Supabase to Redirects.
3. Add the website URL (including `https://`) to Supabase Auth URL Configuration > Redirect URLs.
4. Run `supabase/bot-dashboard.sql` in Supabase SQL Editor.
5. Ensure THE UG bot is invited to each server with only the permissions it needs.

## Important integration boundary
The dashboard authenticates through Supabase Discord OAuth, lists servers where the signed-in user has Manage Server or Administrator permissions, and saves settings in `bot_guild_settings` under per-user Row Level Security. This first dashboard commit does **not** change the running Discord bot. THE UG must be updated separately to read and enforce these settings, and the bot must independently verify guild membership and permissions before applying any setting. Never put a Discord bot token or Supabase service-role key in browser code.
