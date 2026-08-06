import Anthropic from '@anthropic-ai/sdk';
import { CANONICAL_SECRETARIAS } from './constants';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Você é um analista de folha de pagamento. Vai receber dois PDFs do
mesmo mês e da mesma entidade (prefeitura, dinâmica ou saudemed):

1) "Resumo dos Pagamentos com Encargos" — tem, para cada Centro de Custo (secretaria):
   - Totais: Proventos, Descontos, Líquido
   - TOTAL ENCARGOS R.G.P.S.: bloco "Empresa" com "Empregados" (ou "Contr. individ."
     quando não houver "Empregados") e "RAT x FAP"
   - TOTAL ENCARGOS R.P.P.S.: campo "Patronal"

2) "Resumo dos pagamentos por Centro de Custo" — tem, para cada Centro de Custo, a
   linha "Funcionários" (Quantidade) separada da linha "Pensionistas". Use SEMPRE o
   valor de "Funcionários" (nunca some Pensionistas) como número de funcionários.

Para cada secretaria (Centro de Custo Superior — ignore as linhas de sub-centros de
custo, use apenas os totais do centro de custo superior, ex: "302 - SECRETARIA DE
ADMINISTRACAO"), calcule:

- bruto = Proventos (do relatório de Encargos)
- liquido = Líquido (do relatório de Encargos)
- encargos = RAT x FAP + Empresa["Empregados" ou "Contr. individ., o que estiver
  preenchido"] + RPPS["Patronal"]  (todos do relatório de Encargos; NÃO inclua a
  parte "Segurado", que já está descontada do funcionário)
- func = "Funcionários" (Quantidade) do relatório de Centro de Custo, SEM pensionistas

Nomeie cada secretaria usando EXATAMENTE um destes nomes canônicos (escolha o mais
parecido, ignore pequenas diferenças de grafia do PDF):
${CANONICAL_SECRETARIAS.map((s) => `- ${s}`).join('\n')}

Se aparecer uma secretaria que não corresponde a nenhum nome da lista, use o nome
exatamente como está escrito no PDF (em maiúsculas, sem abreviar).

Responda APENAS com um JSON válido (sem markdown, sem texto antes ou depois), no
formato:
{"secretarias":[{"codigo":"302","secretaria":"SECRETARIA DE ADMINISTRACAO","bruto":379974.03,"liquido":297987.85,"encargos":37259.52,"func":110}, ...]}

Inclua uma entrada para CADA centro de custo superior que aparece no relatório de
Encargos. Números com ponto decimal (não use vírgula), sem separador de milhar.`;

function pdfBlock(base64) {
  return {
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: base64 },
  };
}

/**
 * Extrai os dados de uma entidade a partir dos dois PDFs (encargos + centro de custo).
 * Retorna um array de linhas prontas para gravar no Supabase.
 */
export async function extractEntidadeData({ entidade, encargosPdfBase64, ccPdfBase64 }) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Entidade: ${entidade}. Primeiro PDF = relatório de Encargos. Segundo PDF = relatório por Centro de Custo.` },
          pdfBlock(encargosPdfBase64),
          pdfBlock(ccPdfBase64),
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Resposta da IA não trouxe texto.');

  let cleaned = textBlock.text.trim();
  // remove eventuais cercas de código, caso a IA insista em usá-las
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Não consegui interpretar a resposta da IA como JSON: ${err.message}`);
  }

  const rows = (parsed.secretarias || []).map((s) => ({
    entidade,
    codigo: String(s.codigo ?? ''),
    secretaria: String(s.secretaria || '').toUpperCase().trim(),
    bruto: Number(s.bruto) || 0,
    liquido: Number(s.liquido) || 0,
    encargos: Number(s.encargos) || 0,
    func: Number(s.func) || 0,
  }));

  return rows.map((r) => ({ ...r, total: Math.round((r.bruto + r.encargos) * 100) / 100 }));
}
