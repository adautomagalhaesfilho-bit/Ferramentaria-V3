# Perfil — Bomix

Primeira empresa do produto (ferramentaria e usinagem de moldes de injeção plásticos). Responsável: Adauto (supervisor da usinagem). Fuso: America/Sao_Paulo.

> Estado de hoje: turnos, capacidade, rodízio, ajuste da Usinagem, refeição e isentos estão **cadastrados no banco** (`turnos`, `config_sistema`; script em `supabase/perfis/bomix_config.sql`). O código não traz mais valor da Bomix. O ciclo do relatório (RG-13, dia 16) também vem do banco (`bh_ciclo_dia_inicio`). Os limites de ocorrência (RG-14) também vêm do banco (`ocorrencia_gap_*`). Falta só a tela de Configurações para o administrador alterar tudo isso (ver `LEGADO.md`).

## 1. Parâmetros
| Regra | Parâmetro | Valor | Vale a partir de | Onde está hoje |
|---|---|---|---|---|
| RG-01 | 5x2 e Estágio | semanal, segunda a sexta | — | banco (`turnos`) |
| RG-01 | 6x1 | semanal, segunda a sábado | — | banco (`turnos`) |
| RG-01 | 2x2 (Turma A e Turma B) | rodízio de 4 dias; início do ciclo em 17/02/2026, Turma A primeiro | 17/02/2026 | banco (`config_sistema`) |
| RG-02 | Capacidade diária | 5x2 = 528 min; 6x1 = 440; Estágio = 440; Turmas = 660 | — | banco (`turnos`) |
| RG-03 | Ajuste Usinagem (5x2, Turma A, Turma B) | −30 min por dia | 01/09/2026 | banco (`config_sistema`) |
| RG-06 | Isentos de meta e hora extra | setor Supervisão; cargos Supervisor, Encarregado, Líder de Ferramentaria | — | banco (`config_sistema`) |
| RG-08 | Refeição (direito) | 70 min (5x2, 6x1, Estágio); 60 min (2x2: duas refeições, 40 + 20) | — | banco (`config_sistema`) |
| RG-08 | Limite do dia | 300 min | — | banco (`config_sistema`) |
| RG-12 | Hora extra automática | ligada, 07:00, janela de 3 dias | — | banco (agendamento) + função SQL |
| RG-13 | Ciclo do relatório mensal | dia 16 ao dia 15 | — | banco (`config_sistema`) |
| RG-14 | Limites de ocorrência | Produção 1 dia; Bancada 45 dias (com histórico do PCM, a partir de 30/06/2026) ou 7 dias (sem histórico) | 30/06/2026 | banco (`config_sistema`) |
| — | Setores | Usinagem, Bancada, Projeto, Produção (+ Supervisão) | — | código/cadastros |

## 2. Regras específicas da Bomix
- **Início às 08:00 na Usinagem (RG-03/RG-10):** o dia produtivo começa às 08:00; o diálogo diário de segurança (DDS) é feito todo dia mas **não é apontado** e não entra na meta. Não se quer perder 30 min por dia de pessoas nem de máquinas. Vale também para as Turmas A e B.
- **Torno CNC (DMG CLX 450):** opera das 08:00 às 19:30 no 2x2, a partir de 26/10/2026.
- **Refeição sem horário fixo:** cada pessoa almoça quando pode; o desconto é automático por dia (RG-08), decisão do responsável de 18/11/2026.
- **Férias descontam meta; atestado médico e folga compensatória não** (RG-05): decisão do responsável.
- **Moldes por tipo:** PMX (potes) e STX (tampas dos potes) separados de BX (balde) e TX (tampa) nos relatórios.
- **MTTR em tempo corrido (RG-16):** regra decidida; implementação **aguardando liberação** (PR #64 aberto).
- **Parada programada (RG-15):** exceção conhecida: `pcm-indicadores.js` ainda conta como corretiva.

## 3. Casos de aceite
| Situação | Resultado esperado |
|---|---|
| Turma A em 17/02/2026 e 18/02/2026; Turma B em 19 e 20/02 | A trabalha 17–18; B trabalha 19–20; A volta em 21/02 |
| Pessoa 5x2 na Usinagem em 02/09/2026 | capacidade 498 min |
| Pessoa 5x2 na Usinagem em 31/08/2026 | capacidade 528 min |
| Pessoa 5x2 em Bancada em 02/09/2026 | capacidade 528 min (sem ajuste) |
| Turma A na Usinagem em 02/09/2026 | capacidade 630 min |
| 5x2: apontado 08:00–12:00 e 13:10–17:30 | desconto de refeição 0 |
| 5x2: apontado 08:00–17:30 contínuo | desconto 70 min |
| 5x2: apontado 08:00–12:30 | desconto 0 (abaixo de 300 min) |
| Turma A: apontado 08:00–19:30 contínuo | desconto 60 min |
| 5x2: apontado 08:00–12:00 e 12:30–17:30 | desconto 40 min |
| Eder, 08/08/2026 (lançamentos de 07:50 a 19:15, com um de 19:15–19:15) | refeição 70 min, tempo único 685 min |

(Todos os casos acima, exceto o do Eder, estão em `tests/dominio/` com os valores da Bomix; o do Eder foi conferido à mão contra o banco em 18/11/2026.)

## 4. Pendências da Bomix
- Faixas de 15 min com percentual na moda do tempo.
- Cadastro da injetora 220-05 e sistema de injeção de 31 moldes.
- Ocultar números "MOL-xxxx" de projeto para TGM.
- Aviso de apontamentos sobrepostos na mesma máquina ou sem máquina (decidido: sem aviso por enquanto).
- Abertura/fechamento explícito de ocorrência (ideia guardada) e liberação do MTTR em tempo corrido.
- Pedido da empresa de migrar para PHP/Laravel + MySQL (ver documento de transferência/venda no Projeto).
