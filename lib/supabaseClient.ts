// Re-export supabase clients from travel module
export { supabaseAdmin, supabaseClient } from '@/lib/travel/supabase-client';

// Default export for Discord code compatibility
export { supabaseClient as supabase } from '@/lib/travel/supabase-client';
