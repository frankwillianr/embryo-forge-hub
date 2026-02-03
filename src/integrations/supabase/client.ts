import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase credentials not found. Please check your environment variables.');
}

export const supabase = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || ''
);
