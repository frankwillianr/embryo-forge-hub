import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://umauozcntfxgphzbiifz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
