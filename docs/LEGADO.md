# LEGADO.md — versão em produção hoje e plano de migração

> Valores e regras específicas da Bomix: `docs/perfis/bomix.md`. Hoje parte desses valores ainda está como valor de fábrica dentro do código (ajuste da Usinagem, refeição, isentos, ciclo, limites); a coluna "Onde está hoje" do perfil mostra quais, e saem do código nos próximos passos.

Este documento descreve **o que existe agora** (para quem precisa mexer no código atual) e como chegar ao desenho de `ARQUITETURA.md`. Retrato de 18/11/2026, `main` no commit 1375d60.

## 1. Como a versão atual é feita
- Site estático (HTML + JavaScript puro) no GitHub Pages, ligado direto ao Supabase (Postgres + Auth + 1 função de IA). Bibliotecas por CDN: Chart.js, supabase-js, SheetJS, ExcelJS. PWA mínimo (`sw.js`, sem cache).
- 1 `app.html`, 31 arquivos JS (~920 KB), 1 CSS (560 linhas); ~30 `<script>` em ordem manual com `?v=` manual; variáveis globais; HTML montado com `innerHTML` e `onclick`.
- Banco: 38 tabelas, 59 políticas de acesso (todas as tabelas com RLS), 6 funções, 1 gatilho, 12 chaves estrangeiras; esquema em `supabase/schema/`.
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
| Banco de horas | `js/banco-horas.js`, `js/dominio-banco-horas.js` |
| Configurações da empresa (tela do administrador) | `js/configuracoes.js`, `js/configuracoes-salvar.js`, regras em `js/dominio-config-form.js` |
| Exportar moldes (Excel) | `js/exportar-moldes.js` |
| Assistente de IA (leitura) | `supabase/functions/miguelito/index.ts` |

## 3. Onde cada regra mora hoje
| Regra | Implementação atual | Observação |
|---|---|---|
| RG-01 escala | `js/dominio-escala.js` (`funcTrabalhaEmDia`, `turmaEmDia`), configurado por `turnos.dias_semana` e `config_sistema` (`rodizio_start`, `rodizio_turma_start`) | a função SQL `sincronizar_horas_extras` também lê `turnos` e `config_sistema` (migração `0001`) |
| RG-02 capacidade | `capMinutosPorTurno` em `js/dominio-escala.js`, lendo `turnos.capacidade_min` | `calcularCapBancada` (`dashboard.js`) não aplica o RG-03 (sem efeito: ajuste é só da Usinagem) |
| RG-03 ajuste por setor | `capMinutosNaData` em `js/dominio-escala.js`, lendo `config_sistema.ajustes_capacidade` | migrado em 18/11/2026; falta a tela e a vigência com histórico |
| RG-04 turno na data | `turnoNaData` em `js/dominio-escala.js` | |
| RG-05 meta | `calcularMeta` (`dashboard.js`); `diagnostico-meta.js` repete dia a dia | |
| RG-06 isentos | `isSupervisor` em `js/dominio-escala.js`, lendo `config_sistema.isentos_meta` | **ainda resta a cópia em SQL** (`sincronizar_horas_extras`) |
| RG-07 união de tempo | `js/dominio-tempo.js` (`tempoHM`, `tempoIntervalo`, `tempoMesclar`, `tempoUnico`), usado por `dashboard.js`, `diagnostico-meta.js` e `banco-horas.js` | a união de blocos na função SQL continua escrita em SQL (cópia da regra; só o resultado é conferido) |
| RG-08 refeição | `almocoAjusteDia`, `refeicaoDireitoMin` em `js/dominio-refeicao.js`, lendo `config_sistema.refeicao_*`; aplicado também em `diagnostico-meta.js` | `apontamentos.js` (`_calcularMinutos`) ainda desconta 70 min fixos em dados antigos |
| RG-09 automático/ocupação | `_minutosMaquina`, `_minutosAutoLanc`, `_ocupacaoPorGrupo` | |
| RG-10 início produtivo | junto de RG-03 | |
| RG-11 saldo | `banco-horas.js` | |
| RG-12 hora extra | função SQL `sincronizar_horas_extras` (migração `0001`) | só o agendamento a chama; lê a configuração |
| RG-13 ciclo do relatório | `bancoHorasCiclo` (`js/dominio-banco-horas.js`), dia de início em `config_sistema.bh_ciclo_dia_inicio` | |
| RG-14 ocorrência | `confCalcular`, `confLimitesOcorrencia` (`confiabilidade.js`), limites em `config_sistema` (`ocorrencia_gap_*`) | |
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
**Etapa C — Parametrização (concluída em 18/11/2026):** o legado lê `turnos` e `config_sistema` em vez de constantes, e a tela **Configurações** (só administrador) altera tudo, com registro no Log de Alterações. Primeira versão: a mudança vale daqui para frente; "vale a partir de" por parâmetro e pré-visualização do efeito ficam para depois (o ajuste por setor já tem data de início).
**Etapa D — Dados:** fechar as 133 chamadas diretas em repositórios; ids no lugar de nomes; `empresa_id` e política por empresa; migrações numeradas.
**Etapa E — Decisão de plataforma (ADR-001)** com o domínio já testado: manter e evoluir (Supabase) ou reimplantar em outra base (por exemplo, o pedido da Bomix de Laravel/MySQL). O domínio testado serve nos dois caminhos.
**Etapa F — API, integrações, marca branca, operação** conforme `ARQUITETURA.md` §5 e §8, e piloto com duas empresas.

## 6. Como mexer no legado enquanto isso
1. Regra nova ou alterada: atualizar `REGRAS.md` primeiro e aprovar o texto.
2. Implementar no ponto da tabela da seção 3, **sem criar nova cópia** da mesma conta; se precisar de uma já existente, reutilizar a função.
3. Subir o `?v=` do arquivo alterado em `app.html`.
4. Conferir com números reais (consulta ao banco) e registrar correções de dados em `log_alteracoes`.
