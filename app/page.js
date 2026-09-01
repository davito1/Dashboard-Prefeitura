'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { ENTIDADES, ENTIDADE_LABELS, MESES, MESES_ABREV } from '../lib/constants';

const fmtBRL = (v, compact = false) => {
  if (compact) {
    if (Math.abs(v) >= 1000000) return 'R$ ' + (v / 1000000).toFixed(2).replace('.', ',') + ' mi';
    if (Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toFixed(0).replace('.', ',') + ' mil';
  }
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
};
// versão sem abreviação, com centavos — usada nos KPIs do topo, onde a precisão importa
const fmtBRLFull = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v) => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const titleCase = (s) =>
  s
    .split(' ')
    .map((w) => (['DE', 'DA', 'DO', 'E'].includes(w) && w.length <= 4 ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ')
    .replace(/^./, (c) => c.toUpperCase());

export default function Dashboard() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [entidade, setEntidade] = useState('PREFEITURA');
  const [mes, setMes] = useState(null); // null = acumulado
  const [secretaria, setSecretaria] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('payroll_rows')
      .select('*')
      .order('mesnum', { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) setLoadError(error.message);
        else setRows(data || []);
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // meses presentes nos dados, em ordem (define o eixo do gráfico)
  const mesesPresentes = useMemo(() => {
    const nums = [...new Set(rows.map((r) => r.mesnum))].sort((a, b) => a - b);
    return nums;
  }, [rows]);

  const ultimoMes = mesesPresentes[mesesPresentes.length - 1] || null;
  const refMes = mes || ultimoMes;

  const filteredRowsAllMonths = useMemo(() => {
    return entidade === 'TODAS' ? rows : rows.filter((r) => r.entidade === entidade);
  }, [rows, entidade]);

  const filteredRows = useMemo(() => {
    return mes ? filteredRowsAllMonths.filter((r) => r.mesnum === mes) : filteredRowsAllMonths;
  }, [filteredRowsAllMonths, mes]);

  const secretariaOptions = useMemo(() => {
    return [...new Set(filteredRowsAllMonths.map((r) => r.secretaria))].sort();
  }, [filteredRowsAllMonths]);

  const aggregateBySecretaria = useMemo(() => {
    const map = {};
    filteredRows.forEach((r) => {
      if (!map[r.secretaria]) map[r.secretaria] = { secretaria: r.secretaria, bruto: 0, liquido: 0, encargos: 0, total: 0, func: 0 };
      map[r.secretaria].bruto += Number(r.bruto);
      map[r.secretaria].liquido += Number(r.liquido);
      map[r.secretaria].encargos += Number(r.encargos);
      map[r.secretaria].total += Number(r.total);
    });
    if (refMes) {
      filteredRowsAllMonths
        .filter((r) => r.mesnum === refMes)
        .forEach((r) => {
          if (!map[r.secretaria]) map[r.secretaria] = { secretaria: r.secretaria, bruto: 0, liquido: 0, encargos: 0, total: 0, func: 0 };
          map[r.secretaria].func += Number(r.func);
        });
    }
    return Object.values(map);
  }, [filteredRows, filteredRowsAllMonths, refMes]);

  const monthlyTotals = useMemo(() => {
    const rowsForChart = filteredRowsAllMonths.filter((r) => !secretaria || r.secretaria === secretaria);
    return mesesPresentes.map((mnum) => {
      const mrows = rowsForChart.filter((r) => r.mesnum === mnum);
      const sum = (field) => mrows.reduce((a, r) => a + Number(r[field]), 0);
      return { mesnum: mnum, mes: MESES[mnum - 1], bruto: sum('bruto'), liquido: sum('liquido'), encargos: sum('encargos'), total: sum('total'), func: sum('func') };
    });
  }, [filteredRowsAllMonths, secretaria, mesesPresentes]);

  if (loading) {
    return (
      <div className="wrap">
        <div className="empty-state">Carregando dados…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="wrap">
        <div className="empty-state">Erro ao carregar dados: {loadError}</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="wrap">
        <Masthead ultimoMesLabel={null} onLogout={handleLogout} />
        <div className="empty-state">
          Nenhum dado lançado ainda. Envie os PDFs em{' '}
          <a href="/upload" style={{ color: 'var(--blue)', fontWeight: 600 }}>
            /upload
          </a>
          .
        </div>
      </div>
    );
  }

  const scoped = secretaria ? aggregateBySecretaria.filter((a) => a.secretaria === secretaria) : aggregateBySecretaria;
  const totalGeral = scoped.reduce((a, s) => a + s.total, 0);
  const brutoGeral = scoped.reduce((a, s) => a + s.bruto, 0);
  const encargosGeral = scoped.reduce((a, s) => a + s.encargos, 0);

  const refIdx = monthlyTotals.findIndex((m) => m.mesnum === refMes);
  const refMonth = monthlyTotals[refIdx] || { total: 0, func: 0 };
  const prevMonth = refIdx > 0 ? monthlyTotals[refIdx - 1] : null;
  const funcRef = refMonth.func;
  const custoMedio = funcRef > 0 ? refMonth.total / funcRef : 0;
  const variacao = prevMonth && prevMonth.total > 0 ? (refMonth.total - prevMonth.total) / prevMonth.total : null;

  let ranking = [...aggregateBySecretaria].sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(...ranking.map((a) => a.total), 1);

  let tableRows = [...aggregateBySecretaria];
  tableRows.forEach((a) => (a.pct = totalGeral > 0 ? a.total / totalGeral : 0));
  if (search) tableRows = tableRows.filter((a) => a.secretaria.toLowerCase().includes(search.toLowerCase()));
  tableRows.sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'secretaria') return a.secretaria.localeCompare(b.secretaria) * dir;
    return (a[sortKey] - b[sortKey]) * dir;
  });

  const tagLabel = ENTIDADE_LABELS[entidade].toUpperCase();
  const tagClass = entidade === 'TODAS' ? 'tag-TODAS' : `tag-${entidade}`;

  const ultimoMesLabel = ultimoMes ? titleCase(MESES[ultimoMes - 1]) : null;

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleEntidadeClick = (e) => setEntidade(e);
  const handleRankClick = (sec) => setSecretaria(secretaria === sec ? null : sec);

  return (
    <div className="wrap">
      <Masthead ultimoMesLabel={ultimoMesLabel} onLogout={handleLogout} />

      <div className="filterbar">
        <div className="field">
          <label>Entidade</label>
          <div className="segmented">
            {[...ENTIDADES, 'TODAS'].map((e) => (
              <button key={e} className={entidade === e ? 'active' : ''} onClick={() => handleEntidadeClick(e)}>
                {ENTIDADE_LABELS[e]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Mês</label>
          <select value={mes || ''} onChange={(e) => setMes(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Acumulado</option>
            {mesesPresentes.map((mnum) => (
              <option key={mnum} value={mnum}>
                {titleCase(MESES[mnum - 1])}
              </option>
            ))}
          </select>
        </div>
        <div className="field field-grow">
          <label>Secretaria / Centro de Custo</label>
          <select value={secretaria || ''} onChange={(e) => setSecretaria(e.target.value || null)}>
            <option value="">Todas as secretarias</option>
            {secretariaOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <button
            className="btn-secondary"
            onClick={() => {
              setSecretaria(null);
              setMes(null);
            }}
          >
            Limpar seleção
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi label={`Folha ${mes ? 'do mês' : 'acumulada'} c/ encargos`} value={fmtBRLFull(totalGeral)} />
        <Kpi label="Bruto" value={fmtBRLFull(brutoGeral)} />
        <Kpi label="Encargos" value={fmtBRLFull(encargosGeral)} accent="accent-gold" />
        <Kpi label={`Funcionários (${refMes ? titleCase(MESES[refMes - 1]) : '—'})`} value={funcRef.toLocaleString('pt-BR')} accent="accent-green" />
        <Kpi label="Custo médio / funcionário" value={fmtBRLFull(custoMedio)} />
        <div className="kpi">
          <div className="kpi-label">Variação vs. mês anterior</div>
          {variacao === null ? (
            <>
              <div className="kpi-value">—</div>
              <div className="kpi-delta flat">sem mês anterior</div>
            </>
          ) : (
            <>
              <div className="kpi-value">{fmtPct(Math.abs(variacao))}</div>
              <div className={`kpi-delta ${variacao > 0.001 ? 'up' : variacao < -0.001 ? 'down' : 'flat'}`}>
                {variacao > 0 ? '▲ aumento' : variacao < 0 ? '▼ redução' : '— estável'}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="main-grid">
        <div className="panel">
          <h2><span className="sec-num">I.</span>Evolução mensal — Total com encargos</h2>
          <div className="panel-sub">
            {(secretaria || 'TODAS AS SECRETARIAS')} ({ENTIDADE_LABELS[entidade]})
          </div>
          <EvoChart
            monthlyTotals={monthlyTotals}
            selMes={mes}
            series={[
              { field: 'bruto', color: '#d9a536' },
              { field: 'liquido', color: '#34c98a' },
              { field: 'total', color: '#1fae52' },
            ]}
            valueFmt={(v) => fmtBRL(v, true)}
          />
          <div className="legend">
            <span className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--blue)' }} /> Total c/ encargos
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--gold)' }} /> Bruto
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--green)' }} /> Líquido
            </span>
          </div>
        </div>
        <div className="panel">
          <h2><span className="sec-num">II.</span>Ranking por secretaria</h2>
          <div className="panel-sub">{mes ? `Total com encargos — ${titleCase(MESES[mes - 1])}` : 'Total acumulado com encargos'}</div>
          <div className="rank-list">
            {ranking.map((a) => (
              <div key={a.secretaria} className={`rank-row ${secretaria === a.secretaria ? 'selected' : ''}`} onClick={() => handleRankClick(a.secretaria)}>
                <div className="rank-top">
                  <span className="rank-name">{a.secretaria}</span>
                  <span className="rank-val">{fmtBRL(a.total, true)}</span>
                </div>
                <div className="rank-track">
                  <div className="rank-fill" style={{ width: `${((a.total / maxTotal) * 100).toFixed(1)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 22 }}>
        <h2><span className="sec-num">III.</span>Evolução de Funcionários</h2>
        <div className="panel-sub">
          {(secretaria || 'TODAS AS SECRETARIAS')} ({ENTIDADE_LABELS[entidade]})
        </div>
        <EvoChart
          monthlyTotals={monthlyTotals}
          selMes={mes}
          series={[{ field: 'func', color: '#1fae52' }]}
          valueFmt={(v) => Math.round(v).toLocaleString('pt-BR')}
        />
        <div className="legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: '#1fae52' }} /> Funcionários
          </span>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-head-row">
          <div>
            <h2 style={{ margin: 0 }}>
              <span className="sec-num">IV.</span>Detalhamento por centro de custo
            </h2>
            <div className="panel-sub" style={{ marginBottom: 0 }}>
              Clique no cabeçalho para ordenar. Clique numa linha do ranking para filtrar.
            </div>
          </div>
          <input type="text" placeholder="Buscar secretaria..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                {[
                  ['secretaria', 'Secretaria'],
                  ['bruto', 'Bruto'],
                  ['liquido', 'Líquido'],
                  ['encargos', 'Encargos'],
                  ['total', 'Total c/ Encargos'],
                  ['func', 'Funcionários'],
                  ['pct', '% da Folha'],
                ].map(([key, label]) => (
                  <th key={key} className={sortKey === key ? 'sorted' : ''} onClick={() => handleSort(key)}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((a) => (
                <tr key={a.secretaria} className={secretaria === a.secretaria ? 'selected-row' : ''} onClick={() => handleRankClick(a.secretaria)}>
                  <td className="name-cell">
                    {a.secretaria}
                    <span className={`entidade-tag ${tagClass}`}>{tagLabel}</span>
                  </td>
                  <td>{fmtBRLFull(a.bruto)}</td>
                  <td>{fmtBRLFull(a.liquido)}</td>
                  <td>{fmtBRLFull(a.encargos)}</td>
                  <td style={{ fontWeight: 600 }}>{fmtBRLFull(a.total)}</td>
                  <td>{a.func.toLocaleString('pt-BR')}</td>
                  <td className="pct-cell">{fmtPct(a.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="foot-note">
        <span>Fonte: relatórios de Encargos e Centro de Custo, extraídos automaticamente a cada envio.</span>
        <span>Entidades: Prefeitura (RPPS/estatutário) · Dinâmica (contratados) · Saudemed (cooperativa de saúde, código 305).</span>
      </div>
    </div>
  );
}

function Masthead({ ultimoMesLabel, onLogout }) {
  return (
    <>
      <div className="eyebrow">
        <b>Prefeitura Municipal de São Miguel dos Campos</b> · Estado de Alagoas · Publicação mensal
      </div>
      <div className="masthead">
        <div className="masthead-left">
          <img className="crest" src="/crest.png" alt="Brasão da Prefeitura de São Miguel dos Campos" />
          <div>
            <h1>Boletim da Folha de Pagamento</h1>
            <div className="sub">Boletim de acompanhamento da folha de pagamento por secretaria</div>
          </div>
        </div>
        <div className="masthead-right">
          <div className="edicao-box">
            <b>{ultimoMesLabel ? `Ref. ${ultimoMesLabel.toUpperCase()}` : 'Sem edição publicada'}</b>
            Exercício 2026
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className={`stamp ${ultimoMesLabel ? '' : 'stamp-empty'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {ultimoMesLabel ? 'DADOS CONFERIDOS' : 'AGUARDANDO ENVIO'}
            </div>
            <a href="/upload" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Atualizar
            </a>
            {onLogout && (
              <button type="button" className="btn-secondary" onClick={onLogout}>
                Sair
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div className={`kpi ${accent || ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function EvoChart({ monthlyTotals, selMes, series, valueFmt }) {
  const W = 640,
    H = 280,
    padL = 70,
    padR = 20,
    padT = 20,
    padB = 34;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const maxVal = Math.max(...monthlyTotals.flatMap((m) => series.map((s) => m[s.field])), 1) * 1.15;
  const n = monthlyTotals.length;
  const xFor = (i) => padL + (n > 1 ? i / (n - 1) : 0.5) * plotW;
  const yFor = (v) => padT + plotH - (v / maxVal) * plotH;
  const selIdx = selMes ? monthlyTotals.findIndex((m) => m.mesnum === selMes) : -1;

  const line = (field, color) => {
    const pts = monthlyTotals.map((m, i) => `${xFor(i)},${yFor(m[field])}`).join(' ');
    return <polyline key={field} points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />;
  };
  const dots = (field, color) =>
    monthlyTotals.map((m, i) => (
      <circle key={`${field}-${i}`} cx={xFor(i)} cy={yFor(m[field])} r={i === selIdx ? 5 : 3.2} fill={color} stroke={i === selIdx ? '#fff' : 'none'} strokeWidth={i === selIdx ? 1.5 : 0} />
    ));

  const areaField = series[series.length - 1].field;
  const areaColor = series[series.length - 1].color;
  const areaTop = monthlyTotals.map((m, i) => `${xFor(i)},${yFor(m[areaField])}`).join(' ');

  let grid = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const y = padT + (plotH / steps) * i;
    const val = maxVal - (maxVal / steps) * i;
    grid.push(<line key={`gl${i}`} x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="#33364a" strokeWidth="1" />);
    grid.push(
      <text key={`gt${i}`} x={padL - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#9397ab" fontFamily="IBM Plex Mono">
        {valueFmt(val)}
      </text>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 280, display: 'block' }}>
      {grid}
      <polygon points={`${padL},${padT + plotH} ${areaTop} ${padL + plotW},${padT + plotH}`} fill={areaColor} opacity="0.12" />
      {selIdx >= 0 && <line x1={xFor(selIdx)} y1={padT} x2={xFor(selIdx)} y2={padT + plotH} stroke="#9184d9" strokeWidth="1.4" strokeDasharray="3,3" />}
      {series.map((s) => line(s.field, s.color))}
      {series.map((s) => dots(s.field, s.color))}
      {monthlyTotals.map((m, i) => (
        <text key={i} x={xFor(i)} y={H - 10} textAnchor="middle" fontSize="11" fill={i === selIdx ? '#9184d9' : '#9397ab'} fontWeight={i === selIdx ? 700 : 400} fontFamily="IBM Plex Sans">
          {MESES_ABREV[m.mesnum - 1]}
        </text>
      ))}
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#3f424d" strokeWidth="1.4" />
    </svg>
  );
}
