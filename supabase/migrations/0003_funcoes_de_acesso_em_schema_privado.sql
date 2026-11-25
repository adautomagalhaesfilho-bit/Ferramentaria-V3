-- 0003: usuario_ativo() e usuario_admin() saem do schema público (exposto na API) para o schema private.
-- As políticas de acesso continuam funcionando (referem as funções pelo identificador, que acompanha a mudança)
-- e deixam de existir como /rest/v1/rpc/usuario_*, que qualquer usuário logado podia chamar.
-- Conferido em simulação desfeita: administrador lê e grava, supervisor lê e não grava configuração.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.usuario_ativo() set schema private;
alter function public.usuario_admin() set schema private;
