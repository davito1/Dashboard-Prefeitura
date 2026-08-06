import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '../../../lib/supabaseServer';
import { ENTIDADES, MESES } from '../../../lib/constants';

export const runtime = 'nodejs';

// Cliente com a service role key: só existe no servidor, nunca chega ao navegador.
// É usado só para GRAVAR (a leitura de "quem está logado" usa a sessão do usuário).
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function validateRow(r) {
  if (!ENTIDADES.includes(r.entidade)) return `entidade inválida: ${r.entidade}`;
  if (!r.secretaria || typeof r.secretaria !== 'string') return 'secretaria ausente';
  if (!Number.isInteger(r.ano) || r.ano < 2020 || r.ano > 2100) return `ano inválido: ${r.ano}`;
  if (!Number.isInteger(r.mesnum) || r.mesnum < 1 || r.mesnum > 12) return `mesnum inválido: ${r.mesnum}`;
  for (const field of ['bruto', 'liquido', 'encargos', 'total']) {
    if (typeof r[field] !== 'number' || Number.isNaN(r[field])) return `${field} inválido em ${r.secretaria}`;
  }
  if (!Number.isInteger(r.func) || r.func < 0) return `func inválido em ${r.secretaria}`;
  return null;
}

export async function POST(request) {
  try {
    // 1) confirma que quem está chamando está logado (sessão via cookie)
    const supabaseAuth = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    // 2) processa o envio
    const body = await request.json();
    const { rows } = body || {};

    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ error: 'Nenhuma linha para gravar.' }, { status: 400 });
    }
    if (rows.length > 500) {
      return Response.json({ error: 'Muitas linhas em um único envio (máximo 500).' }, { status: 400 });
    }

    const rowsToUpsert = [];
    for (const r of rows) {
      const err = validateRow(r);
      if (err) return Response.json({ error: `Linha inválida: ${err}` }, { status: 400 });

      rowsToUpsert.push({
        entidade: r.entidade,
        codigo: String(r.codigo ?? ''),
        secretaria: String(r.secretaria).toUpperCase().trim(),
        ano: r.ano,
        mesnum: r.mesnum,
        mes: MESES[r.mesnum - 1],
        bruto: r.bruto,
        liquido: r.liquido,
        encargos: r.encargos,
        total: r.total,
        func: r.func,
        updated_at: new Date().toISOString(),
      });
    }

    const { error } = await supabaseAdmin.from('payroll_rows').upsert(rowsToUpsert, { onConflict: 'entidade,secretaria,ano,mesnum' });

    if (error) {
      return Response.json({ error: `Erro ao gravar no banco: ${error.message}` }, { status: 500 });
    }

    const periodos = [...new Set(rowsToUpsert.map((r) => `${r.mes}/${r.ano}`))];
    const entidadesEnviadas = [...new Set(rowsToUpsert.map((r) => r.entidade))];

    await supabaseAdmin.from('upload_log').insert({
      ano: rowsToUpsert[0].ano,
      mesnum: rowsToUpsert[0].mesnum,
      entidades: entidadesEnviadas.join(','),
      linhas_gravadas: rowsToUpsert.length,
    });

    return Response.json({ ok: true, linhas: rowsToUpsert.length, periodos, entidades: entidadesEnviadas });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message || 'Erro inesperado ao processar o arquivo.' }, { status: 500 });
  }
}
