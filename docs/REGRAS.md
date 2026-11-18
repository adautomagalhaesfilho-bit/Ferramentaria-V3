# REGRAS.md — regras de negócio da Ferramentaria V3

Versão de 18/11/2026, conferida contra o código da branch `main` (commit 1375d60) e o banco de produção.

**Como ler.** Cada regra tem:
- **ID** (`RG-xx`) para citar em pedidos, PRs e testes;
- **Regra** em português;
- **Nível**: `PADRÃO` = igual para todas as empresas; `CONFIGURÁVEL` = cada empresa define o valor (na tela, ver `MULTIEMPRESA.md`); `ESPECÍFICA` = só existe por escolha da empresa;
- **Valor Bomix** = o valor praticado hoje;
- **Hoje no código** = onde mora (para saber o que mexer) e se há duplicação;
- **Teste**: `sim` (existe teste no histórico das tarefas, ainda a migrar para `tests/`) ou `a criar`.

Mudou uma regra? Altere aqui primeiro, aprove o texto, depois o teste, depois o código.

---

## A. Turnos, escala e meta

### RG-01 Escala de trabalho por turno — CONFIGURÁVEL
Cada turno diz em quais dias a pessoa trabalha.
- **5x2**: segunda a sexta, exceto feriado.
- **Estágio**: igual ao 5x2.
- **6x1**: segunda a sábado, exceto feriado.
- **Turma A / Turma B (2x2)**: rodízio de 4 dias — 2 dias trabalhando, 2 de folga. A Turma A trabalha nos dois primeiros dias do ciclo e a Turma B nos dois seguintes. O ciclo começou em **17/02/2026** com a Turma A.
- Turno desconhecido: tratado como 5x2.
- **Hoje no código:** `funcTrabalhaEmDia`, `turmaEmDia`, constante `RODIZIO_START` em `dashboard.js`. **Duplicada em SQL** na função `sincronizar_horas_extras` (data `2026-02-17` e dias da semana escritos de novo). A tabela `config_sistema` já guarda `rodizio_start` e `rodizio_turma_start`, mas o código não a usa.
- **Teste:** a criar.

### RG-02 Capacidade diária por turno (meta da pessoa) — CONFIGURÁVEL
Minutos de trabalho esperados por dia de escala.
- **Valor Bomix:** 5x2 = 528; 6x1 = 440; Estágio = 440; Turma A/B = 660.
- **Hoje no código:** `capMinutosPorTurno` (valores fixos). A tabela `turnos` **já tem** `capacidade_min`, horários de entrada/saída e `intervalo_min` com esses mesmos valores, mas o dashboard não a consulta. `calcularCapBancada` usa a função fixa, sem o ajuste do RG-03.
- **Teste:** a criar.

### RG-03 Ajuste de início às 08:00 na Usinagem — ESPECÍFICA (por setor, com vigência)
Desde **01/09/2026**, na Usinagem, quem é 5x2 ou Turma A/B tem a meta diária reduzida em **30 minutos**, porque os primeiros 30 min são do DDS (diálogo diário de segurança) e o tempo produtivo conta a partir das 08:00. Dias anteriores não mudam. Vale só para a meta da ocupação; o banco de horas continua com a jornada contratual.
- O DDS **não** é lançado como apontamento. Pessoas e máquinas contam tempo a partir das 08:00.
- Torno CNC (DMG CLX 450) opera 08:00–19:30 no 2x2 (desde 26/10/2026).
- **Hoje no código:** `capMinutosNaData` e `INICIO_08H_USINAGEM` em `dashboard.js`.
- **Teste:** a criar.

### RG-04 Turno da pessoa numa data — PADRÃO
Vale o turno do histórico (`funcionario_turno_historico`) que cobre a data. Antes da primeira mudança registrada, o turno era 5x2. Sem histórico, vale o turno atual do cadastro.
- **Hoje no código:** `turnoNaData` (`dashboard.js`).
- **Teste:** a criar.

### RG-05 Meta da pessoa no período — PADRÃO
Soma, dia a dia, da capacidade do RG-02/RG-03, **somente** nos dias em que:
- a data está entre a admissão e a demissão;
- a pessoa não está de **férias** (motivo "Férias");
- o dia é de escala (RG-01).
De cada dia desconta-se o intervalo das **ausências parciais** (`rh_parciais`) com início e fim.
Atestado e folga não removem a meta sozinhos: o dia cai na meta e aparece no diagnóstico (RG-20).
- **Hoje no código:** `calcularMeta` (`dashboard.js`). `diagnostico-meta.js` repete a lógica dia a dia.
- **Teste:** a criar.

### RG-06 Quem fica fora da meta — CONFIGURÁVEL
Supervisão não entra nos cálculos de ocupação/produtividade nem gera hora extra automática: setor "Supervisão" ou cargos Supervisor, Encarregado, Líder de Ferramentaria. Essas pessoas aparecem nas listas de lançamento.
- **Hoje no código:** `isSupervisor` (`dashboard.js`); **duplicado em SQL** (`sincronizar_horas_extras`).
- **Teste:** a criar.

---

## B. Tempo, almoço e ocupação

### RG-07 Tempo da pessoa sem contar duas vezes — PADRÃO
Lançamentos que se sobrepõem no mesmo dia da mesma pessoa contam uma vez só (união dos intervalos). Sem sobreposição, o total é exatamente a soma dos minutos.
- Lançamento que passa da meia-noite (fim menor que início) soma 24 h ao fim.
- **Hoje no código:** `_minutosSemSobreposicao` (`dashboard.js`); `_confUniaoMin` (`confiabilidade.js`); `_dmBuracos` (`diagnostico-meta.js`); `banco-horas.js` mescla blocos de novo; **SQL** em `sincronizar_horas_extras`. Cinco cópias da mesma ideia.
- **Teste:** sim.

### RG-08 Almoço obrigatório, descontado automaticamente por dia — CONFIGURÁVEL
Ninguém deixa de almoçar. O desconto é por **pessoa e dia**, calculado (nada é gravado), sem caixa para marcar.
- **Direito (Bomix):** 70 min para 5x2, 6x1 e estágio; **60 min** para turmas 2x2 (duas refeições, 40 + 20).
- **Não existe horário fixo** de almoço.
- Só desconta se o tempo lançado no dia passar de **300 min** (5 h); até isso a pessoa não chegou a almoçar.
- O que ficou **sem lançamento entre um lançamento e outro** já conta como refeição; só se desconta o que faltar até completar o direito.
- Lançamentos antigos que já tiveram desconto gravado (caixa marcada, até 70 min) entram na conta para não descontar duas vezes.
- **Hoje no código:** `almocoAjusteDia`, `almocoDireitoMin`, `ALMOCO_MIN_DIA` (`dashboard.js`); `diagnostico-meta.js` aplica o mesmo ajuste. Dados antigos: `_calcularMinutos` ainda tem o desconto fixo de 70 min para almoço marcado entre 12:00 e 13:10 (`apontamentos.js`).
- **Teste:** sim.

### RG-09 Tempo em automático e ocupação de máquina — PADRÃO
Uso da máquina no dia = tempo único dos lançamentos + "tempo em automático" informado (a máquina seguiu trabalhando sozinha). O automático pode passar do expediente, então a ocupação pode passar de 100%.
- **Hoje no código:** `_minutosMaquina`, `_minutosAutoLanc`, `_ocupacaoPorGrupo` (`dashboard.js`); capacidade da máquina por vigência em `maquina_capacidade_historico`.
- **Teste:** a criar.

---

## C. Banco de horas

### RG-10 Saldo do banco de horas — PADRÃO
Saldo = **último acerto de saldo** (valor oficial digitado numa data) + lançamentos **Validados** com data **depois** do acerto. O que é do dia do acerto ou anterior fica no extrato, mas não soma. "Pendente" aparece à parte; "Recusado" não conta.
- **Hoje no código:** `banco-horas.js` (valem para tela, ficha e dashboard).
- **Teste:** a criar.

### RG-11 Hora extra automática — CONFIGURÁVEL
Todo dia às 07:00 (horário de Brasília; agendamento `horas-extras-0700` no pg_cron do Supabase, 10:00 UTC) o sistema confere os lançamentos dos últimos dias e cria crédito **Pendente** de banco de horas:
- **Dia de escala:** minutos lançados fora do horário do turno (entrada antecipada e/ou saída após o fim). Dentro do horário é jornada normal.
- **Dia fora da escala:** todo o tempo trabalhado (blocos sobrepostos mesclados).
- Não duplica (referência `HE-<nome>-<data>`); ignora quem não tem turno ativo cadastrado e a supervisão (RG-06).
- Um responsável valida ou recusa (RG-10).
- **Hoje no código:** função SQL `sincronizar_horas_extras` (chamada só pelo agendamento, não pelas telas) (a regra de escala está **escrita de novo em SQL**, com a data do rodízio fixa).
- **Teste:** a criar.

### RG-12 Ciclo do relatório mensal — CONFIGURÁVEL
O relatório do banco de horas cobre do dia **16** ao dia **15** mais recente já ocorrido.
- **Hoje no código:** `_cicloBH` (`banco-horas.js`).

---

## D. Confiabilidade do molde (MTBF / MTTR)

### RG-13 Ocorrência de corretiva — PADRÃO (limites CONFIGURÁVEIS)
Ocorrência = corretivas do mesmo molde (Produção + Bancada) que são **a mesma falha**:
- Se o molde **voltou à máquina** entre duas corretivas, são ocorrências diferentes.
- Corretiva de **Produção** se junta à anterior se estiver a no máximo **1 dia** de distância.
- Corretiva de **Bancada** se junta se estiver a até **45 dias** (com histórico do PCM, a partir de 30/06/2026) ou até **7 dias** (sem histórico).
- Vários técnicos no mesmo serviço da bancada geram um lançamento cada: conta **uma vez**.
- Hoje a ocorrência é só um agrupamento; não há abertura/fechamento explícito. **Ideia guardada para refinar depois:** abrir e fechar por eventos do PCM (sai da injetora por corretiva → volta e roda sem nova corretiva, ou "liberado para produção" marcado por responsável). Perguntas em aberto: quando considerar o molde "consertado" e se o fechamento é automático ou manual.
- **Hoje no código:** `confCalcular`, `CONF_GAP_BANCADA_DIAS` (`confiabilidade.js`).
- **Teste:** a criar.

### RG-14 Parada programada — PADRÃO
Lançamento marcado como **parada programada** (Produção e Bancada) **não** aparece como ocorrência de corretiva, mesmo se o tipo for corretiva.
- **Exceção conhecida:** `pcm-indicadores.js` ainda conta parada programada como corretiva (a corrigir se o Adauto confirmar).
- **Hoje no código:** filtros `!l.parada_programada` em `confiabilidade.js` e `dashboard.js`; coluna `parada_programada` em `lancamentos` e `prod_lancamentos`.
- **Teste:** sim.

### RG-15 MTTR do molde — PADRÃO (⚠ em decisão)
Regra decidida pelo Adauto: MTTR = **tempo corrido** de parada do molde, que começa na corretiva e só termina quando o molde volta a produzir; **nunca somar horas de várias pessoas ou setores**. Vale para todos os moldes. Antes de 30/06/2026 (início do histórico do PCM) usa trabalho efetivo sem sobreposição.
- **Estado:** implementada no PR #64, **aberto e não mergeado**. Na `main` ainda vale a soma do tempo de trabalho. Só voltar ao assunto quando o Adauto pedir.
- **Teste:** sim (na branch do #64).

### RG-16 MTBF — PADRÃO
Tempo montado na injetora (histórico do PCM) e ciclos (contador) entre ocorrências consecutivas. Contador zerado continua somando. Só usa informação que a Ferramentaria controla.
- **Hoje no código:** `confCalcular` (`confiabilidade.js`).

---

## E. Diagnóstico e dashboard

### RG-17 Diagnóstico da meta — PADRÃO
Mostra por que a meta de cada pessoa/máquina ficou abaixo: dia sem apontamento, horário sem lançamento, atestado/folga, máquina parada. Usa as mesmas regras do dashboard, dia a dia, sem alterar dados.
- Cabeçalho de **feriado** marcado como FER.
- Pessoas de turma 2x2 aparecem com a turma e linhas de "dia de folga".
- **"O que cobrar":** só dias **passados** (nunca o dia atual) e só quando **não há nenhum lançamento** no dia.
- **Hoje no código:** `diagnostico-meta.js`.
- **Teste:** sim.

### RG-18 Setores e áreas — CONFIGURÁVEL
O sistema trabalha com Usinagem, Bancada, Projeto e Produção. Quais setores existem, quais lançam apontamento e quais entram em meta deve ser configuração por empresa.
- **Hoje no código:** nomes de setor escritos direto (~258 ocorrências em `js/`); `prod_categorias`, `tipos_servico`, `motivos_parada` já são tabelas editáveis.

---

## F. Acesso e auditoria

### RG-19 Login e perfis — PADRÃO
Login pelo **nome** (internamente `<nome>@ferramentaria.local` no Supabase Auth). Perfis em uso: `admin`, `gestor`, `supervisor`, `pcm` e `operador`, mais permissões por setor/tela (`usuarios.permissoes`). Admin e gestor veem tudo; os demais veem o próprio setor (regra de tela em `app.js`; o banco só exige usuário ativo). No banco, só usuário **ativo** acessa (`usuario_ativo()`); só **admin** altera usuários (`usuario_admin()`).
- **Hoje no código:** `app.js`, `supabase.js`; políticas RLS (ver `supabase/schema/`).

### RG-20 Auditoria — PADRÃO
Toda alteração relevante grava em `log_alteracoes` (tabela, registro, ação, campo, valor antigo e novo, usuário, data). Vale para correções feitas direto no banco também.
- **Hoje no código:** `registrarLog` (`supabase.js`).

---

## G. Regras ainda por esclarecer (não implementar sem confirmar)
- Moda do tempo em faixas de 15 min com % (pendente de decisão).
- Cadastro da injetora 220-05 e sistema de injeção de 31 moldes sem esse dado.
- Esconder números "MOL-xxxx" de projeto para TGM.
- Aviso de lançamentos sobrepostos na mesma máquina ou sem máquina (decidido: sem botão/aviso por enquanto).
- Abertura/fechamento explícito de ocorrência (ver RG-13).
