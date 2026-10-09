/*
  ARA Supabase browser configuration.
  Replace both placeholders with your Supabase Project URL and Publishable key.
  NEVER put an sb_secret_ key or service_role key in this file.
*/
window.ARA_SUPABASE_URL = "https://fxwemcgzpcvipikwhzsv.supabase.co";
window.ARA_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_k102iqcECKtwLrku4sZi_Q_3E70XKmI";

window.ARA_SUPABASE_CLIENT = null;
if (
  window.supabase &&
  window.ARA_SUPABASE_URL.startsWith("https://") &&
  !window.ARA_SUPABASE_URL.includes("PASTE_") &&
  window.ARA_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_") &&
  !window.ARA_SUPABASE_PUBLISHABLE_KEY.includes("PASTE_")
) {
  window.ARA_SUPABASE_CLIENT = window.supabase.createClient(
    window.ARA_SUPABASE_URL,
    window.ARA_SUPABASE_PUBLISHABLE_KEY
  );
}
