import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Cliente do servidor: lê a sessão de login a partir dos cookies da requisição.
// Usado nas rotas de API para confirmar que quem está chamando está autenticado.
export function createServerSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // chamado a partir de um contexto sem permissão de escrever cookie — pode ignorar
        }
      },
    },
  });
}
