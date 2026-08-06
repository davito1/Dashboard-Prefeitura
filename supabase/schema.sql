-- Rode isto uma vez no seu projeto Supabase: SQL Editor > New query > colar > Run

create table if not exists payroll_rows (
  id bigint generated always as identity primary key,
  entidade text not null,           -- 'PREFEITURA' | 'DINAMICA' | 'COOPREV'
  codigo text,                       -- codigo do centro de custo (informativo)
  secretaria text not null,          -- nome normalizado da secretaria
  ano int not null,
  mesnum int not null,               -- 1-12
  mes text not null,                 -- 'JANEIRO', 'FEVEREIRO', ...
  bruto numeric not null default 0,
  liquido numeric not null default 0,
  encargos numeric not null default 0,   -- custo patronal (RAT x FAP + patronal + RPPS patronal)
  total numeric not null default 0,      -- bruto + encargos
  func int not null default 0,           -- funcionarios reais (sem pensionistas)
  updated_at timestamptz not null default now(),
  unique (entidade, secretaria, ano, mesnum)
);

create index if not exists idx_payroll_rows_periodo on payroll_rows (ano, mesnum);
create index if not exists idx_payroll_rows_entidade on payroll_rows (entidade);

-- Row Level Security: só quem estiver logado (autenticado no Supabase Auth) pode
-- LER os dados. Só a service role key (usada na rota de upload, no servidor) pode
-- escrever.
alter table payroll_rows enable row level security;

create policy "Leitura autenticada" on payroll_rows
  for select
  to authenticated
  using (true);

-- Nenhuma policy de insert/update/delete para a role "authenticated" -> só service role escreve.

-- Tabela simples de log de uploads, para voce ver o historico de atualizacoes
create table if not exists upload_log (
  id bigint generated always as identity primary key,
  ano int not null,
  mesnum int not null,
  entidades text not null,     -- ex: 'PREFEITURA,DINAMICA,COOPREV'
  linhas_gravadas int not null default 0,
  criado_em timestamptz not null default now()
);

alter table upload_log enable row level security;

create policy "Leitura autenticada log" on upload_log
  for select
  to authenticated
  using (true);
