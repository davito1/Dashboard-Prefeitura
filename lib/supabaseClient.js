import { createClient } from '@supabase/supabase-js';

// Cliente do navegador: usa a chave anônima (somente leitura, protegida por RLS).
// Nunca coloque a service role key aqui.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
