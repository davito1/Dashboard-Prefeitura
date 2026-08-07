import { createServerSupabaseClient } from '../lib/supabaseServer';
import PainelClient from './PainelClient';

export const dynamic = 'force-dynamic';

export default async function PainelPage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows, error } = await supabase
    .from('payroll_rows')
    .select('*')
    .order('ano', { ascending: true })
    .order('mesnum', { ascending: true });

  if (error) {
    return (
      <div className="wrap">
        <div className="empty-state" style={{ marginTop: 40 }}>
          Erro ao carregar os dados: {error.message}
        </div>
      </div>
    );
  }

  return <PainelClient rows={rows || []} userEmail={user?.email || ''} />;
}
