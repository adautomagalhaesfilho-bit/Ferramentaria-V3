# Esquema do banco (retrato de 18/11/2026)

Retrato do projeto Supabase de produção (`iiaxqbswpqfsjxrsoiqd`), schema `public`. Serve como **ponto de partida** das migrações: daqui em diante toda mudança de banco entra em `supabase/migrations/NNNN_descricao.sql`.

- `01_tabelas.sql` — 38 tabelas (colunas, tipos, padrões). Chaves primárias, chaves estrangeiras (12) e índices **não** estão neste retrato; extrair com `pg_dump --schema-only` antes da Fase 3.
- `02_politicas_rls.md` — as 57 políticas de acesso por tabela.
- `03_funcoes.sql` — funções e gatilho do schema `public`.

Nenhuma tabela tem `empresa_id` ainda (ver `docs/MULTIEMPRESA.md`).

**Agendamento (pg_cron):** `horas-extras-0700`, cron `0 10 * * *` (07:00 Brasília), chama `sincronizar_horas_extras` para os últimos dias. Deve ser recriado em qualquer banco novo.
