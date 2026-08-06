-- Rode isto no SQL Editor do Supabase (você já rodou o schema.sql original antes;
-- isto só troca a regra de leitura de "qualquer um" para "só quem está logado").

drop policy if exists "Leitura publica" on payroll_rows;
drop policy if exists "Leitura publica log" on upload_log;

create policy "Leitura autenticada" on payroll_rows
  for select
  to authenticated
  using (true);

create policy "Leitura autenticada log" on upload_log
  for select
  to authenticated
  using (true);
