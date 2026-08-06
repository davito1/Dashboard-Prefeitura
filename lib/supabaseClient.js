import { createBrowserClient } from '@supabase/ssr';

// Cliente do navegador: usa a chave anônima (protegida por RLS) e guarda a sessão
// de login em cookies, para o middleware conseguir ler quem está logado.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
