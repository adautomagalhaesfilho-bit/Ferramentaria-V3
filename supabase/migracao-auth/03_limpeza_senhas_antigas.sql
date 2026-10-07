-- =====================================================================
-- 03_limpeza_senhas_antigas.sql — (ETAPA 3 de 3, OPCIONAL, semanas depois)
-- =====================================================================
-- Apaga a coluna com os hashes SHA-256 das senhas antigas, que não são mais
-- usados por nada. Só rode quando tiver certeza de que não vai voltar ao
-- login antigo (depois disso, voltar exige recadastrar as senhas).
-- =====================================================================

begin;
alter table public.usuarios drop column if exists senha;
commit;
