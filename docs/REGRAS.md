# REGRAS.md — regras de negócio do produto

Este documento define **como o produto calcula as coisas**. É a fonte da verdade: código e testes seguem este texto, nunca o contrário.

## Como ler
- **ID** (`RG-xx`): usado em pedidos, PRs, testes e mensagens de erro.
- **Padrão**: igual para todas as empresas. Só muda por decisão de produto.
- **Parâmetro**: cada empresa define o valor na tela de configuração. O texto mostra o **valor inicial** (o que o produto traz de fábrica).
- **Vigência**: todo parâmetro tem "vale a partir de". Mudar uma regra nunca altera o passado já fechado.
- **Casos de ouro**: exemplos numéricos que viram testes automáticos. Regra sem caso de ouro não está pronta.
- **Perfil de referência**: a primeira empresa (Bomix) serve de exemplo e de teste, não de padrão do produto. Os valores dela estão ao final de cada regra, em *Exemplo*.

Fluxo para mudar uma regra: editar aqui → aprovar o texto → ajustar casos de ouro → implementar.

---

## 1. Vocabulário
| Termo | Significado |
|---|---|
| Empresa | cliente do produto; tudo pertence a uma empresa |
| Setor | área da empresa (ex.: Usinagem, Bancada, Produção, Projeto) |
| Pessoa | funcionário/técnico que faz apontamentos |
| Turno | modelo de jornada (horário, dias, capacidade) |
| Escala | regra que diz em quais dias um turno trabalha |
| Apontamento (lançamento) | registro de tempo: quem, o quê, onde (máquina/molde), início e fim |
| Capacidade | minutos que a pessoa ou a máquina deveria entregar no dia |
| Meta | soma da capacidade no período, descontadas ausências |
| Ocupação | tempo apontado ÷ meta (ou ÷ capacidade da máquina) |
| Ocorrência | falha de um molde, agrupando corretivas que são a mesma falha |

---

## 2. Escala, turnos e meta

### RG-01 Escala de trabalho — parâmetro por turno
Cada turno tem um **tipo de escala**:
- **Semanal**: lista de dias da semana em que trabalha; feriado da empresa é folga. Ex.: 5x2 = segunda a sexta; 6x1 = segunda a sábado.
- **Rodízio**: ciclo de N dias com X dias de trabalho seguidos de folga, com **data de início do ciclo** e **qual turma começa**. Ex.: 2x2 com duas turmas (A e B): A trabalha os dois primeiros dias do ciclo, B os dois seguintes.

*Valor inicial:* 5x2, 6x1 e Estágio (igual 5x2) semanais; 2x2 em rodízio de 4 dias.
*Exemplo (Bomix):* ciclo 2x2 iniciado em 17/02/2026 com a Turma A.
*Caso de ouro:* 17/02/2026 e 18/02/2026 → Turma A trabalha, B folga; 19 e 20/02 → B trabalha, A folga; 21/02 volta A.

### RG-02 Capacidade diária — parâmetro por turno
Minutos esperados de trabalho por dia de escala, já descontados intervalos. Vem do cadastro do turno (entrada, saída, intervalo).
*Exemplo (Bomix):* 5x2 = 528; 6x1 e Estágio = 440; Turmas 2x2 = 660.

### RG-03 Ajuste de capacidade por setor — parâmetro com vigência
Uma empresa pode reduzir ou aumentar a capacidade diária de um **setor + turno** a partir de uma data (ex.: tempo de segurança diária que não é produtivo). Afeta só meta e ocupação, nunca o banco de horas.
*Exemplo (Bomix):* a partir de 01/09/2026, Usinagem (5x2 e turmas) com −30 min por dia, porque o dia produtivo começa às 08:00 e o diálogo diário de segurança não é apontado.
*Caso de ouro:* Usinagem, 5x2, 02/09/2026 → capacidade 498; em 31/08/2026 → 528.

### RG-04 Turno da pessoa em uma data
Vale o turno do histórico que cobre a data. Antes da primeira mudança registrada, vale o **turno padrão da empresa**. Sem histórico, o turno atual do cadastro.

### RG-05 Meta da pessoa no período
Soma da capacidade (RG-02/RG-03) dos dias em que:
- a data está entre admissão e demissão;
- a pessoa não está de **férias**;
- o dia é de escala (RG-01).
Subtrai as **ausências parciais** (intervalo com início e fim). Atestado e folga não removem a meta sozinhos: aparecem no diagnóstico (RG-17).
*Caso de ouro:* pessoa 5x2, admitida em 01/10, período 01–07/10 sem feriado: dias úteis × capacidade.

### RG-06 Quem fica fora de metas e hora extra — parâmetro
A empresa lista **cargos e/ou setores isentos** (normalmente chefia). Eles podem lançar, mas não entram em meta, ocupação nem hora extra automática.
*Exemplo (Bomix):* setor Supervisão; cargos Supervisor, Encarregado, Líder de Ferramentaria.

---

## 3. Tempo, almoço e ocupação

### RG-07 Tempo sem contar duas vezes — padrão
Apontamentos da mesma pessoa que se sobrepõem no mesmo dia contam **uma vez** (união dos intervalos). Sem sobreposição, o total é a soma. Apontamento que passa da meia-noite soma 24 h ao fim.
*Caso de ouro:* 08:00–10:00 e 09:00–11:00 → 180 min, não 240.

### RG-08 Refeição obrigatória, descontada por dia — parâmetro
Refeição é obrigatória e **não tem horário fixo**. O desconto é calculado por **pessoa e dia**; ninguém marca nada.
- Parâmetros: **direito de refeição por turno** (minutos) e **limite mínimo do dia** (só desconta se o tempo apontado único passar disso).
- O tempo **sem apontamento entre um apontamento e outro** já conta como refeição. Só se desconta o que faltar até completar o direito.
- Descontos já registrados em apontamentos antigos entram na conta para não descontar duas vezes.
- Nada é gravado: é cálculo do dia.
*Valor inicial:* limite do dia = 300 min.
*Exemplo (Bomix):* 70 min para 5x2, 6x1 e Estágio; 60 min para 2x2 (duas refeições, 40 + 20).
*Casos de ouro:*
1. 5x2, apontado 08:00–12:00 e 13:10–17:30, sem outro desconto → lacuna de 70 → desconto 0.
2. 5x2, apontado 08:00–17:30 contínuo → desconto 70.
3. 5x2, apontado 08:00–12:30 (270 min) → desconto 0 (abaixo do limite).

### RG-09 Tempo em automático e ocupação de máquina — padrão
Uso da máquina no dia = tempo único apontado + **tempo em automático** informado (a máquina seguiu sozinha). A ocupação pode passar de 100% quando o automático ultrapassa o expediente. A capacidade da máquina vem do **histórico de capacidade por vigência**.

### RG-10 Início do tempo produtivo — parâmetro por setor
Cada setor define a partir de que horário começa a contar tempo produtivo (e que atividades não se apontam, como o diálogo de segurança). Alinha com RG-03.

---

## 4. Banco de horas

### RG-11 Saldo — padrão
Saldo = **último acerto de saldo** (valor oficial digitado numa data) + lançamentos **Validados** com data **depois** do acerto. O que é da data do acerto ou anterior fica no extrato e não soma. *Pendente* aparece à parte; *Recusado* não conta.

### RG-12 Hora extra automática — parâmetro (liga/desliga e horário)
Diariamente, em horário configurado, o produto confere os apontamentos dos últimos dias e cria crédito **Pendente**:
- **Dia de escala:** minutos fora do horário do turno (entrada antecipada e saída depois do fim). Dentro do horário é jornada normal.
- **Dia fora da escala:** todo o tempo trabalhado (blocos sobrepostos mesclados).
- Não duplica; ignora isentos (RG-06) e pessoas sem turno.
- Um responsável valida ou recusa (RG-11). Toda decisão é auditada.
*Valor inicial:* ligado, 07:00 no fuso da empresa, janela de 3 dias.
*Regra de implementação:* usa **a mesma função de escala** (RG-01) que o resto do produto; não existe segunda cópia.

### RG-13 Ciclo do relatório mensal — parâmetro
Dia de início do ciclo de fechamento. *Exemplo (Bomix):* do dia 16 ao dia 15.

---

## 5. Confiabilidade de moldes (MTBF / MTTR)

### RG-14 Ocorrência de corretiva — padrão, limites parametrizáveis
Corretivas do mesmo molde (Produção + Bancada) que são a mesma falha formam **uma ocorrência**:
- se o molde **voltou à máquina** entre duas corretivas, são ocorrências diferentes;
- corretiva de **Produção** junta se estiver a até **1 dia** da anterior;
- corretiva de **Bancada** junta se estiver a até **45 dias** (com histórico de PCM) ou **7 dias** (sem histórico);
- vários técnicos no mesmo serviço contam **uma vez**.
*Evolução prevista:* abrir e fechar a ocorrência por eventos do PCM (saiu da injetora por corretiva → voltou e rodou sem nova corretiva, ou "liberado para produção" marcado por responsável). Perguntas abertas: quando o molde conta como consertado; fechamento automático ou manual.

### RG-15 Parada programada — padrão
Apontamento marcado como **parada programada** nunca vira ocorrência de corretiva, em nenhum indicador (confiabilidade, dashboard, PCM).

### RG-16 MTTR — padrão (em decisão)
MTTR do molde = **tempo corrido** de parada: começa na corretiva e termina quando o molde volta a produzir. **Nunca soma horas de várias pessoas ou setores.** Antes do início do histórico de PCM, usa trabalho efetivo sem sobreposição.
*Estado:* regra decidida; implementação aguardando liberação do responsável.

### RG-17 MTBF — padrão
Tempo montado na injetora (histórico do PCM) e ciclos (contador) entre ocorrências consecutivas. Contador zerado continua somando. Só entram informações que a empresa controla.

---

## 6. Diagnóstico e acompanhamento

### RG-18 Diagnóstico da meta — padrão
Mostra por que a meta ficou abaixo, por pessoa e máquina: dia sem apontamento, horário sem apontamento, atestado/folga, máquina parada. Usa as mesmas regras deste documento, dia a dia, e **não altera dados**.
- Feriado aparece sinalizado; pessoas em rodízio mostram a turma e os dias de folga.
- **"O que cobrar":** apenas dias **passados** (nunca o dia atual) e apenas quando **não há nenhum apontamento** no dia.

---

## 7. Setores e cadastros — parâmetro
A empresa define seus **setores** e, para cada um: se lança apontamento, se entra em meta, tipos de serviço, motivos de parada, categorias, máquinas. O produto não assume nomes de setor.

---

## 8. Acesso, perfis e auditoria

### RG-19 Perfis e permissões — padrão com permissões parametrizáveis
Perfis de fábrica: administrador da empresa, gestor, supervisor, PCM, operador. Cada perfil tem permissões por setor e por tela; a empresa pode ajustar. Administrador e gestor veem todos os setores; os demais, o próprio. Usuário inativo não acessa nada. Só administrador gerencia usuários.

### RG-20 Auditoria — padrão
Toda alteração relevante grava: o que, registro, campo, valor antigo, valor novo, quem e quando. Correção feita direto no banco também é registrada. O registro de auditoria não pode ser editado.

---

## 9. Decisões em aberto (não implementar sem confirmar)
- Faixas de 15 min com percentual na moda do tempo.
- Cadastro de injetora e de sistema de injeção ainda faltantes em alguns moldes.
- Ocultar números de projeto de determinados clientes.
- Aviso de apontamentos sobrepostos na mesma máquina ou sem máquina.
- Abertura/fechamento explícito de ocorrência (RG-14) e liberação do MTTR (RG-16).
