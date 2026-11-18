# CLAUDE.md — mapa do projeto Ferramentaria V3

Leia este arquivo primeiro. Ele existe para não precisar ler o código inteiro (~920 KB) a cada tarefa.

## O que é
Sistema de gestão de ferramentaria/usinagem de moldes (apontamentos, produção, PCM, RH, banco de horas, ficha do molde, dashboards).
Produto em construção para ser **vendável a várias empresas**, em dois modelos: SaaS (nós hospedamos) e instalação dedicada por cliente.
Hoje roda para a Bomix. Nenhuma regra nova deve nascer "só da Bomix" no código: ver `docs/MULTIEMPRESA.md`.

## Stack atual
HTML + JavaScript puro (sem módulos/bundler), GitHub Pages, Supabase (Postgres + Auth + 1 Edge Function). PWA mínimo (`sw.js`, sem cache).
Bibliotecas por CDN: Chart.js, supabase-js, SheetJS, ExcelJS. Decisão sobre migrar a base técnica: **adiada para depois da Fase 0** (ver `docs/ARQUITETURA.md`).

## Onde está cada assunto (js/)
| Assunto | Arquivo(s) |
|---|---|
| Dados / banco (REST, auth, domínio) | `supabase.js` (objeto `db`) |
| Entrada, login, menu, sessão, permissões | `app.js` |
| Apontamento da bancada / usinagem | `apontamentos.js`, `wizard-usinagem.js` |
| Apontamento da produção (injetoras) | `producao.js` |
| Dashboard (meta, ocupação, **almoço**, turnos) | `dashboard.js` |
| Diagnóstico da meta (por que ficou abaixo) | `diagnostico-meta.js` |
| Confiabilidade do molde (MTTR/MTBF/ocorrências) | `confiabilidade.js` |
| Ficha do molde | `ficha.js` |
| PCM e indicadores | `pcm.js`, `pcm-indicadores.js` |
| RH (funcionários, férias, parciais, turnos) | `rh.js` |
| Banco de horas | `banco-horas.js` |
| Exportar moldes para Excel | `exportar-moldes.js` |
| Assistente de IA (somente leitura) | `supabase/functions/miguelito/index.ts` |
Ordem de carga e versões (`?v=`) dos scripts: `app.html`. **Ao mudar um .js, suba o `?v=` dele em `app.html`.**

## Onde estão as regras de negócio
Fonte da verdade em português: **`docs/REGRAS.md`** (cada regra tem ID `RG-xx`).
Hoje as regras estão misturadas no código das telas (principalmente `dashboard.js`) e uma parte duplicada em SQL (`sincronizar_horas_extras`). `REGRAS.md` diz onde cada uma mora.

## Fluxo de trabalho (SDD — especificação primeiro)
1. Pedido do Adauto em português.
2. Atualizar/criar a regra em `docs/REGRAS.md` e **aprovar o texto com ele**.
3. Escrever/ajustar o teste da regra.
4. Implementar. Rodar testes.
5. Branch → commit → PR. **Merge somente quando o Adauto disser "faça o merge" citando o(s) PR(s).**
Ajustes visuais pequenos (alinhamento, cor, legenda) podem ser feitos direto; regra ou dado: perguntar antes.

## Convenções
- Datas como texto `YYYY-MM-DD`; usar `T12:00:00` ao criar `Date` (evita erro de fuso). Fuso do negócio: America/Sao_Paulo.
- Toda alteração de dado relevante grava auditoria: `registrarLog(tabela, id, acao, campo, antigo, novo)` → `log_alteracoes`.
- Não apagar dados sem pedido explícito. Chaves/segredos só em segredos do Supabase, nunca no código.
- Mensagens e textos da tela em português do Brasil.
- Banco: todas as 38 tabelas têm RLS. Mudança de banco entra em `supabase/migrations/` (a pasta começa na Fase 0; ver `supabase/schema/`).

## Como testar hoje
Não há suíte no repositório ainda (Fase 0 cria `tests/`). Os testes usados nas tarefas rodam em Node (`vm` com stubs) e Playwright. Funções puras exportadas por `module.exports` (ex.: `almocoAjusteDia` em `dashboard.js`) podem ser testadas direto.

## Fora do escopo / não mexer sem pedir
PR #64 (MTTR em tempo corrido) está aberto e **não deve ser mergeado** até o Adauto voltar ao assunto.
