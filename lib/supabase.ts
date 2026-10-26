import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Permite mostrar uma tela de erro amigável em vez de quebrar o app inteiro
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(
  url || 'http://localhost:54321',
  anonKey || 'missing-anon-key'
);
