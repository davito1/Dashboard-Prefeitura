'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { ENTIDADES, ENTIDADE_LABELS, MESES, MESES_ABREV } from '../lib/constants';

const STRING_KEYS = new Set(['secretaria', 'codigo']);

const fmtBRL = (v) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtNum = (v) => (v || 0).toLocaleString('pt-BR');
const fmtPct = (v) => `${(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const periodKey = (ano, mesnum) => ano * 100 + mesnum;
const sum = (list, field) => list.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);

function Kpi({ label, value, delta, accent }) {
  return (
    <div className={`kpi${accent ? ` accent-${accent}` : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta !== null && (
        <div className={`kpi-delta ${delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat'}`}>
          {delta > 0.5 ? '▲' : delta < -0.5 ? '▼' : '—'}{' '}
          {Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs mês anterior
        </div>
      )}
    </div>
  );
}

export default function PainelClient({ rows, userEmail }) {
  const router = useRouter();
  const [entidade, setEntidade] = useState('TODAS');
  const [periodo, setPeriodo] = useState(null);
  const [busca, setBusca] = useState('');
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const periods = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const k = periodKey(r.ano, r.mesnum);
      if (!map.has(k)) map.set(k, { ano: r.ano, mesnum: r.mesnum });
    }
    return [...map.values()].sort((a, b) => periodKey(b.ano, b.mesnum) - periodKey(a.ano, a.mesnum));
  }, [rows]);

  const currentPeriodo = periodo || periods[0] || null;
  const periodoIdx = currentPeriodo
    ? periods.findIndex((p) => p.ano === currentPeriodo.ano && p.mesnum === currentPeriodo.mesnum)
    : -1;
  const periodoAnterior = periodoIdx >= 0 && periodoIdx < periods.length - 1 ? periods[periodoIdx + 1] : null;

  const matchEntidade = (r) => entidade === 'TODAS' || r.entidade === entidade;

  const rowsPeriodo = useMemo(() => {
    if (!currentPeriodo) return [];
    return rows.filter((r) => r.ano === currentPeriodo.ano && r.mesnum === currentPeriodo.mesnum && matchEntidade(r));
  }, [rows, currentPeriodo, entidade]);

  const rowsPeriodoAnterior = useMemo(() => {
    if (!periodoAnterior) return [];
    return rows.filter((r) => r.ano === periodoAnterior.ano && r.mesnum === periodoAnterior.mesnum && matchEntidade(r));
  }, [rows, periodoAnterior, entidade]);

  const kpis = useMemo(() => {
    const cur = {
      bruto: sum(rowsPeriodo, 'bruto'),
      liquido: sum(rowsPeriodo, 'liquido'),
      encargos: sum(rowsPeriodo, 'encargos'),
      total: sum(rowsPeriodo, 'total'),
      func: sum(rowsPeriodo, 'func'),
    };
    const prev = {
      bruto: sum(rowsPeriodoAnterior, 'bruto'),
      liquido: sum(rowsPeriodoAnterior, 'liquido'),
      encargos: sum(rowsPeriodoAnterior, 'encargos'),
      total: sum(rowsPeriodoAnterior, 'total'),
      func: sum(rowsPeriodoAnterior, 'func'),
    };
    const delta = (key) => (prev[key] ? ((cur[key] - prev[key]) / prev[key]) * 100 : null);
    return { cur, delta };
  }, [rowsPeriodo, rowsPeriodoAnterior]);

  const evolucao = useMemo(() => {
    const chron = [...periods].reverse().slice(-12);
    return chron.map((p) => {
      const list = rows.filter((r) => r.ano === p.ano && r.mesnum === p.mesnum && matchEntidade(r));
      return {
        label: `${MESES_ABREV[p.mesnum - 1]}/${String(p.ano).slice(2)}`,
        total: sum(list, 'total'),
        encargos: sum(list, 'encargos'),
      };
    });
  }, [rows, periods, entidade]);

  const ranking = useMemo(() => {
    const list = [...rowsPeriodo].sort((a, b) => b.total - a.total).slice(0, 10);
    const max = list.length ? list[0].total : 1;
    return { list, max };
  }, [rowsPeriodo]);

  const tabela = useMemo(() => {
    const totalGeral = sum(rowsPeriodo, 'total') || 1;
    const termo = busca.trim().toLowerCase();
    let list = rowsPeriodo
      .filter((r) => !termo || r.secretaria.toLowerCase().includes(termo))
      .map((r) => ({ ...r, pct: (r.total / totalGeral) * 100 }));
    list.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (STRING_KEYS.has(sortKey)) {
        return sortDir === 'asc' ? String(va).localeCompare(vb) : String(vb).localeCompare(va);
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return list;
  }, [rowsPeriodo, busca, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const chartW = 680;
  const chartH = 200;
  const maxVal = Math.max(1, ...evolucao.map((d) => d.total), ...evolucao.map((d) => d.encargos));
  const buildPath = (key) =>
    evolucao
      .map((d, i) => {
        const x = evolucao.length > 1 ? (i * chartW) / (evolucao.length - 1) : chartW / 2;
        const y = chartH - (d[key] / maxVal) * chartH;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const ultimaAtualizacao = rowsPeriodo.length
    ? new Date(Math.max(...rowsPeriodo.map((r) => new Date(r.updated_at).getTime())))
    : null;

  return (
    <div className="wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div className="eyebrow">
          <b>Prefeitura Municipal de São Miguel dos Campos</b> · Estado de Alagoas · Publicação mensal
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/upload" className="btn-secondary" style={{ textDecoration: 'none' }}>
            Atualizar dados
          </a>
          <button type="button" className="btn-secondary" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </div>

      <div className="masthead">
        <div className="masthead-left">
          <img className="crest" src="/crest.png" alt="Brasão" />
          <div>
            <h1>Boletim da Folha de Pagamento</h1>
            <div className="sub">Acompanhamento por secretaria, mês e entidade</div>
          </div>
        </div>
        <div className="masthead-right">
          <div className="edicao-box">
            <b>{currentPeriodo ? `${MESES[currentPeriodo.mesnum - 1]}/${currentPeriodo.ano}` : '—'}</b>
            Período de referência
          </div>
          {ultimaAtualizacao ? (
            <div className="stamp">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Atualizado <span className="stamp-date">{ultimaAtualizacao.toLocaleDateString('pt-BR')}</span>
            </div>
          ) : (
            <div className="stamp stamp-empty">Sem dados neste período</div>
          )}
        </div>
      </div>

      {periods.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          Nenhum dado cadastrado ainda. Envie o primeiro arquivo de atualização em{' '}
          <a href="/upload">/upload</a>.
        </div>
      ) : (
        <>
          <div className="filterbar">
            <div className="field">
              <label>Entidade</label>
              <div className="segmented">
                {['TODAS', ...ENTIDADES].map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={entidade === e ? 'active' : ''}
                    onClick={() => setEntidade(e)}
                  >
                    {ENTIDADE_LABELS[e]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Período</label>
              <select
                value={currentPeriodo ? periodKey(currentPeriodo.ano, currentPeriodo.mesnum) : ''}
                onChange={(e) => {
                  const k = Number(e.target.value);
                  const found = periods.find((p) => periodKey(p.ano, p.mesnum) === k);
                  if (found) setPeriodo(found);
                }}
              >
                {periods.map((p) => (
                  <option key={periodKey(p.ano, p.mesnum)} value={periodKey(p.ano, p.mesnum)}>
                    {MESES[p.mesnum - 1]}/{p.ano}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field-grow">
              <label>Buscar secretaria</label>
              <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite parte do nome…" />
            </div>
            <button
              type="button"
              className="clear-btn"
              onClick={() => {
                setEntidade('TODAS');
                setPeriodo(periods[0] || null);
                setBusca('');
              }}
            >
              Limpar filtros
            </button>
          </div>

          <div className="kpi-row">
            <Kpi label="Bruto" value={fmtBRL(kpis.cur.bruto)} delta={kpis.delta('bruto')} />
            <Kpi label="Líquido" value={fmtBRL(kpis.cur.liquido)} delta={kpis.delta('liquido')} />
            <Kpi label="Encargos" value={fmtBRL(kpis.cur.encargos)} delta={kpis.delta('encargos')} accent="gold" />
            <Kpi label="Total da Folha" value={fmtBRL(kpis.cur.total)} delta={kpis.delta('total')} accent="green" />
            <Kpi label="Funcionários" value={fmtNum(kpis.cur.func)} delta={kpis.delta('func')} />
            <Kpi label="Secretarias / CCs" value={fmtNum(rowsPeriodo.length)} delta={null} />
          </div>

          <div className="main-grid">
            <div className="panel">
              <h2>Evolução da Folha</h2>
              <div className="panel-sub">Total e encargos por mês — {ENTIDADE_LABELS[entidade]}</div>
              {evolucao.length > 1 ? (
                <>
                  <svg id="evoChart" viewBox={`0 0 ${chartW} ${chartH + 26}`} preserveAspectRatio="none">
                    <path d={buildPath('total')} fill="none" stroke="var(--blue)" strokeWidth="2" />
                    <path d={buildPath('encargos')} fill="none" stroke="var(--gold)" strokeWidth="2" />
                    {evolucao.map((d, i) => {
                      const x = evolucao.length > 1 ? (i * chartW) / (evolucao.length - 1) : chartW / 2;
                      return (
                        <text key={d.label} x={x} y={chartH + 18} fontSize="9" textAnchor="middle" fill="var(--ink-soft)">
                          {d.label}
                        </text>
                      );
                    })}
                  </svg>
                  <div className="legend">
                    <div className="legend-item">
                      <span className="legend-dot" style={{ background: 'var(--blue)' }}></span>Total da folha
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot" style={{ background: 'var(--gold)' }}></span>Encargos
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state">Ainda não há meses suficientes para mostrar a evolução.</div>
              )}
            </div>

            <div className="panel">
              <h2>Ranking por Secretaria</h2>
              <div className="panel-sub">
                Top {ranking.list.length} por custo total — {currentPeriodo ? `${MESES[currentPeriodo.mesnum - 1]}/${currentPeriodo.ano}` : ''}
              </div>
              {ranking.list.length ? (
                <div className="rank-list">
                  {ranking.list.map((r) => (
                    <div key={`${r.entidade}-${r.secretaria}`} className="rank-row">
                      <div className="rank-top">
                        <span className="rank-name">
                          {r.secretaria}
                          {entidade === 'TODAS' && (
                            <span className={`entidade-tag tag-${r.entidade}`}>{ENTIDADE_LABELS[r.entidade]}</span>
                          )}
                        </span>
                        <span className="rank-val">{fmtBRL(r.total)}</span>
                      </div>
                      <div className="rank-track">
                        <div className="rank-fill" style={{ width: `${(r.total / ranking.max) * 100}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Sem dados para este período.</div>
              )}
            </div>
          </div>

          <div className="table-panel">
            <div className="table-head-row">
              <h2>Detalhamento por Secretaria</h2>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{tabela.length} registro(s)</div>
            </div>
            {tabela.length ? (
              <table>
                <thead>
                  <tr>
                    <th className={sortKey === 'secretaria' ? 'sorted' : ''} onClick={() => toggleSort('secretaria')}>
                      Secretaria
                    </th>
                    <th className={sortKey === 'codigo' ? 'sorted' : ''} onClick={() => toggleSort('codigo')}>
                      Código
                    </th>
                    <th className={sortKey === 'func' ? 'sorted' : ''} onClick={() => toggleSort('func')}>
                      Funcionários
                    </th>
                    <th className={sortKey === 'bruto' ? 'sorted' : ''} onClick={() => toggleSort('bruto')}>
                      Bruto
                    </th>
                    <th className={sortKey === 'liquido' ? 'sorted' : ''} onClick={() => toggleSort('liquido')}>
                      Líquido
                    </th>
                    <th className={sortKey === 'encargos' ? 'sorted' : ''} onClick={() => toggleSort('encargos')}>
                      Encargos
                    </th>
                    <th className={sortKey === 'total' ? 'sorted' : ''} onClick={() => toggleSort('total')}>
                      Total
                    </th>
                    <th className={sortKey === 'pct' ? 'sorted' : ''} onClick={() => toggleSort('pct')}>
                      % do total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tabela.map((r) => (
                    <tr key={`${r.entidade}-${r.secretaria}`}>
                      <td className="name-cell">
                        {r.secretaria}
                        {entidade === 'TODAS' && (
                          <span className={`entidade-tag tag-${r.entidade}`}>{ENTIDADE_LABELS[r.entidade]}</span>
                        )}
                      </td>
                      <td>{r.codigo || '—'}</td>
                      <td>{fmtNum(r.func)}</td>
                      <td>{fmtBRL(r.bruto)}</td>
                      <td>{fmtBRL(r.liquido)}</td>
                      <td>{fmtBRL(r.encargos)}</td>
                      <td>{fmtBRL(r.total)}</td>
                      <td className="pct-cell">{fmtPct(r.pct)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="name-cell" style={{ fontWeight: 700 }}>
                      Total geral
                    </td>
                    <td></td>
                    <td style={{ fontWeight: 700 }}>{fmtNum(sum(tabela, 'func'))}</td>
                    <td style={{ fontWeight: 700 }}>{fmtBRL(sum(tabela, 'bruto'))}</td>
                    <td style={{ fontWeight: 700 }}>{fmtBRL(sum(tabela, 'liquido'))}</td>
                    <td style={{ fontWeight: 700 }}>{fmtBRL(sum(tabela, 'encargos'))}</td>
                    <td style={{ fontWeight: 700 }}>{fmtBRL(sum(tabela, 'total'))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <div className="empty-state">Nenhuma secretaria encontrada com esses filtros.</div>
            )}
          </div>
        </>
      )}

      <div className="foot-note">
        <span>Fonte: dados enviados manualmente via /upload · {rows.length} registro(s) no total</span>
        <span>Sessão: {userEmail}</span>
      </div>
    </div>
  );
}
