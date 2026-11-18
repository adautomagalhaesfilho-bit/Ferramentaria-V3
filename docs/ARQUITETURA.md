# ARQUITETURA.md — situação atual e roteiro

Análise completa (com números e justificativas): documento "Ferramentaria V3 — Análise de arquitetura" do Projeto "Controle de dados V2" (18/11/2026). Resumo aqui.

## Situação atual (18/11/2026)
- Site estático (HTML + JS puro) no GitHub Pages falando direto com o Supabase. 1 `app.html`, 31 arquivos JS (~920 KB), 1 CSS.
- Código por tela, variáveis globais, ~30 `<script>` em ordem manual com `?v=` manual, HTML montado com `innerHTML`/`onclick`.
- 133 chamadas diretas ao banco fora de `supabase.js`.
- Regras de negócio dentro das telas e repetidas (5 cópias da união de intervalos; escala duplicada em SQL).
- Banco: 38 tabelas, RLS em todas, 6 funções, 1 gatilho. Esquema não estava versionado (agora está em `supabase/schema/`).
- Sem testes no repositório, sem CI, sem API pública.

## Por que a alteração gasta tanto token
Arquivos de 40–86 KB e linhas de até ~1.200 caracteres; regra espalhada em 3–4 arquivos; valores fixos repetidos; sem mapa. Alvo: arquivo ≤ 300 linhas, regra em um lugar só, teste ao lado.

## Estrutura-alvo
```
src/dominio/    regras puras (tempo, almoço, turnos, meta, confiabilidade, banco de horas)
src/dados/      único acesso ao banco (repositórios, auth, auditoria)
src/telas/      só desenha e captura clique
src/integracao/ API v1, webhooks, importadores/exportadores
src/config/     leitura da configuração da empresa
tests/          testes das regras
supabase/migrations/   alterações de banco versionadas
docs/           REGRAS.md, MULTIEMPRESA.md, ARQUITETURA.md
```

## Roteiro
**Fase 0 — Especificação e base (esta etapa; nada muda para o usuário)**
- [x] `CLAUDE.md` (mapa)
- [x] `docs/REGRAS.md`, `docs/MULTIEMPRESA.md`, `docs/ARQUITETURA.md`
- [x] Esquema do banco versionado: `supabase/schema/`
- [ ] Mover os testes das tarefas para `tests/` (almoço, união de tempo, diagnóstico, parada programada)
- [ ] Rodar testes automaticamente no GitHub (CI)
- [ ] Formatar linhas gigantes

**Fase 1 — Regras fora das telas (por assunto, 1 PR cada, com teste):** tempo+almoço → turnos/escala/meta (lendo `turnos`) → confiabilidade → banco de horas (unificando a cópia SQL). Fechar as 133 chamadas diretas em repositórios.

**Decisão:** base técnica (manter Supabase ou migrar) — só depois da Fase 1, com as regras testadas.

**Fase 2 — Base moderna:** módulos ES + Vite, arquivos pequenos, sem `onclick` em texto, hospedagem com subdomínio por cliente.

**Fase 3 — Pronto para vender:** multiempresa (`MULTIEMPRESA.md` §7), marca branca, perfis configuráveis, backups testados, monitoramento, correção dos avisos de segurança do Supabase, LGPD e termos.

**Integração (junto da Fase 3):** API REST `/api/v1` com chave por empresa (OpenAPI), webhooks de saída, importação de RH por matrícula, exportação Excel/BI, entrada de dados de máquinas.

## Pendências de segurança conhecidas
- `usuario_admin()` e `usuario_ativo()` (SECURITY DEFINER) executáveis por usuários autenticados.
- Proteção contra senha vazada desativada no Supabase Auth.
- `ia_config` e `ia_uso` com RLS sem política.
- Girar a chave da IA; trocar senha provisória do usuário Eder.lopes; backups.
