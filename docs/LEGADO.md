# LEGADO.md — versão em produção hoje e plano de migração

Este documento descreve **o que existe agora** (para quem precisa mexer no código atual) e como chegar ao desenho de `ARQUITETURA.md`. Retrato de 18/11/2026, `main` no commit 1375d60.

## 1. Como a versão atual é feita
- Site estático (HTML + JavaScript puro) no GitHub Pages, ligado direto ao Supabase (Postgres + Auth + 1 função de IA). Bibliotecas por CDN: Chart.js, supabase-js, SheetJS, ExcelJS. PWA mínimo (`sw.js`, sem cache).
- 1 `app.html`, 31 arquivos JS (~920 KB), 1 CSS (560 linhas); ~30 `<script>` em ordem manual com `?v=` manual; variáveis globais; HTML montado com `innerHTML` e `onclick`.
- Banco: 38 tabelas, 57 políticas de acesso (todas as tabelas com RLS), 6 funções, 1 gatilho, 12 chaves estrangeiras; esquema em `supabase/schema/`.
- Agendamento `horas-extras-0700` (pg_cron, 07:00 de Brasília).
- Sem testes no repositório, sem CI, sem API pública, sem `empresa_id`.

## 2. Mapa de arquivos
| Assunto | Arquivo(s) |
|---|---|
| Banco, auth, domínio de dados (`db`) | `js/supabase.js` |
| Entrada, login, menu, sessão, permissões | `js/app.js` |
| Apontamento bancada/usinagem | `js/apontamentos.js`, `js/wizard-usinagem.js` |
| Apontamento produção (injetoras) | `js/producao.js` |
| Dashboard (meta, ocupação, refeição, turnos) | `js/dashboard.js` |
| Diagnóstico da meta | `js/diagnostico-meta.js` |
| Confiabilidade do molde | `js/confiabilidade.js` |
| Ficha do molde | `js/ficha.js` |
| PCM e indicadores | `js/pcm.js`, `js/pcm-indicadores.js` |
| RH | `js/rh.js` |
| Banco de horas | `js/banco-horas.js` |
| Exportar moldes (Excel) | `js/exportar-moldes.js` |
| Assistente de IA (leitura) | `supabase/functions/miguelito/index.ts` |

## 3. Onde cada regra mora hoje
| Regra | Implementação atual | Observação |
|---|---|---|
| RG-01 escala | `funcTrabalhaEmDia`, `turmaEmDia`, `RODIZIO_START` (`dashboard.js`) | **também em SQL** (`sincronizar_horas_extras`); tabela `config_sistema` já guarda `rodizio_start` mas não é usada |
| RG-02 capacidade | `capMinutosPorTurno` (`dashboard.js`) | tabela `turnos` já tem os mesmos valores e não é lida; `calcularCapBancada` ignora RG-03 |
| RG-03 ajuste por setor | `capMinutosNaData`, `INICIO_08H_USINAGEM` | fixo para Usinagem e 01/09/2026 |
| RG-04 turno na data | `turnoNaData` | |
| RG-05 meta | `calcularMeta` (`dashboard.js`); `diagnostico-meta.js` repete dia a dia | |
| RG-06 isentos | `isSupervisor` (`dashboard.js`) | **também em SQL** |
| RG-07 união de tempo | `js/dominio-tempo.js` (`tempoHM`, `tempoIntervalo`, `tempoMesclar`, `tempoUnico`), usado por `dashboard.js`, `diagnostico-meta.js` e `banco-horas.js` | **ainda resta a cópia em SQL** (`sincronizar_horas_extras`); migrado em 18/11/2026 |
| RG-08 refeição | `almocoAjusteDia`, `almocoDireitoMin`, `ALMOCO_MIN_DIA` (`dashboard.js`, agora sobre `dominio-tempo.js`), aplicado também em `diagnostico-meta.js` | `apontamentos.js` (`_calcularMinutos`) ainda desconta 70 min fixos em dados antigos |
| RG-09 automático/ocupação | `_minutosMaquina`, `_minutosAutoLanc`, `_ocupacaoPorGrupo` | |
| RG-10 início produtivo | junto de RG-03 | |
| RG-11 saldo | `banco-horas.js` | |
| RG-12 hora extra | função SQL `sincronizar_horas_extras` | só o agendamento a chama |
| RG-13 ciclo 16→15 | `_cicloBH` (`banco-horas.js`) | |
| RG-14 ocorrência | `confCalcular`, `CONF_GAP_BANCADA_DIAS` (`confiabilidade.js`) | |
| RG-15 parada programada | filtros `!parada_programada` em `confiabilidade.js` e `dashboard.js` | **`pcm-indicadores.js` ainda conta como corretiva** |
| RG-16 MTTR | soma de trabalho na `main`; tempo corrido no **PR #64 (não mergeado)** | |
| RG-17 MTBF | `confCalcular` | |
| RG-18 diagnóstico | `diagnostico-meta.js` | |
| RG-19 perfis | `app.js` (tela) + `usuario_ativo()`/`usuario_admin()` (banco) | perfis em uso: admin, gestor, supervisor, pcm, operador |
| RG-20 auditoria | `registrarLog` (`supabase.js`) → `log_alteracoes` | |

## 4. Custos e riscos conhecidos
- Arquivos grandes (dashboard 86 KB, rh 81, apontamentos 65, pcm 60, app 54, pcm-indicadores 53, banco-horas 51, diagnostico-meta 40, supabase 39, ficha 31) e linhas de até ~1.200 caracteres: cada alteração exige muita leitura.
- 133 chamadas diretas ao banco fora de `supabase.js`; ~258 nomes de setor e ~78 de turno/turma escritos direto no código.
- Pessoas e moldes ligados por nome em texto em várias tabelas.
- Segurança pendente: `usuario_admin()`/`usuario_ativo()` executáveis por usuários autenticados; proteção de senha vazada desativada; `ia_config`/`ia_uso` com RLS sem política; girar a chave da IA; senha provisória do usuário Eder.lopes; backups.

## 5. Plano de migração (do legado ao desenho de `ARQUITETURA.md`)
**Etapa A — Especificação e rede de proteção (em andamento)**
- [x] `CLAUDE.md`, `REGRAS.md`, `MULTIEMPRESA.md`, `ARQUITETURA.md`, `LEGADO.md`
- [x] Esquema do banco versionado (`supabase/schema/`)
- [ ] Casos de ouro de `REGRAS.md` como testes em `tests/dominio/`
- [ ] Execução automática dos testes no GitHub
**Etapa B — Núcleo de domínio extraído (1 pull request por assunto, resultado idêntico na tela)**
tempo → escala → refeição → meta/ocupação → banco de horas (unificando a cópia SQL) → confiabilidade.
**Etapa C — Parametrização:** o legado passa a ler `turnos`, `config_sistema` e uma tabela de configuração em vez de constantes.
**Etapa D — Dados:** fechar as 133 chamadas diretas em repositórios; ids no lugar de nomes; `empresa_id` e política por empresa; migrações numeradas.
**Etapa E — Decisão de plataforma (ADR-001)** com o domínio já testado: manter e evoluir (Supabase) ou reimplantar em outra base (por exemplo, o pedido da Bomix de Laravel/MySQL). O domínio testado serve nos dois caminhos.
**Etapa F — API, integrações, marca branca, operação** conforme `ARQUITETURA.md` §5 e §8, e piloto com duas empresas.

## 6. Como mexer no legado enquanto isso
1. Regra nova ou alterada: atualizar `REGRAS.md` primeiro e aprovar o texto.
2. Implementar no ponto da tabela da seção 3, **sem criar nova cópia** da mesma conta; se precisar de uma já existente, reutilizar a função.
3. Subir o `?v=` do arquivo alterado em `app.html`.
4. Conferir com números reais (consulta ao banco) e registrar correções de dados em `log_alteracoes`.
