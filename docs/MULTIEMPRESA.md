# MULTIEMPRESA.md — como o sistema atende várias empresas

Decisões do Adauto (18/11/2026):
- **Modelos de venda:** os dois — **SaaS** (nós hospedamos, uma instalação para vários clientes) e **instalação dedicada** (banco próprio de um cliente).
- **Regras diferentes por empresa:** **configuráveis na tela**, sem mexer em código.
- **Base técnica (Supabase x Laravel/MySQL):** decidir depois da Fase 0. Tudo aqui vale nas duas.

## 1. Princípio
O código contém só **mecanismos** (como calcular almoço, meta, ocorrência). Os **valores** (70 min, 528 min, quais turnos, quais setores) vêm da configuração da empresa. Nada com o nome "Bomix" no código.

## 2. Camadas de regra
| Nível | Quem decide | Exemplo | Onde fica |
|---|---|---|---|
| PADRÃO | o produto | união de lançamentos sobrepostos (RG-07) | código |
| CONFIGURÁVEL | o administrador da empresa | minutos de almoço por turno (RG-08) | tabela de configuração |
| ESPECÍFICA | só um cliente, com vigência | meta −30 min na Usinagem desde 01/09/2026 (RG-03) | tabela de configuração com setor e data de início |

Cada regra de `REGRAS.md` já traz o nível. Regra ESPECÍFICA vira **parâmetro com vigência**, nunca um `if (empresa === ...)`.

## 3. Modelo de dados proposto
- `empresas` (id, nome, slug/subdomínio, logo, cores, fuso, plano, ativo).
- **`empresa_id` em todas as tabelas de negócio** (hoje 38 tabelas, nenhuma tem). Índice por `empresa_id`.
- `usuarios.empresa_id`; perfil `super_admin` (nosso, atravessa empresas) separado de `admin` da empresa.
- **RLS por empresa:** `empresa_id = empresa_do_usuario()` em todas as políticas, substituindo o atual "usuário ativo". É o que impede uma empresa ver dados de outra; teste obrigatório antes do primeiro cliente.
- **Configuração:** `config_empresa` (empresa_id, chave, valor jsonb, vigente_desde, vigente_ate). Ex.: `almoco.direito_min.5x2 = 70`, `almoco.limite_dia_min = 300`, `meta.ajuste_setor.Usinagem = -30 desde 2026-09-01`, `escala.rodizio_inicio = 2026-02-17`, `bh.ciclo_dia_inicio = 16`.
- Já existem e viram por empresa: `turnos` (capacidade, horários, intervalo, dias da semana), `feriados`, `cargos`, `tipos_servico`, `motivos_parada`, `prod_categorias`, `maquinas`, `config_sistema` (hoje com `rodizio_start`).
- **Setores** passam a ser tabela (`setores`: nome, lança apontamento?, entra em meta?, grupo), em vez de texto fixo no código (RG-18).

## 4. Mapa: regra → o que precisa virar configuração
| Regra | Hoje | Passa a ser |
|---|---|---|
| RG-01 escala | constantes no JS e no SQL | `turnos.dias_semana` + tipo de rodízio + início do ciclo |
| RG-02 capacidade | função com números fixos (a tabela `turnos` já tem os mesmos) | ler `turnos.capacidade_min` |
| RG-03 −30 min Usinagem | constante com data fixa | `config_empresa` com setor e vigência |
| RG-06 quem fica fora | nomes de cargo no código | lista de cargos/setores isentos |
| RG-08 almoço | 70/60/300 no código | direito por turno + limite do dia |
| RG-11 hora extra | SQL com escala duplicada | mesma função de escala, lendo a configuração |
| RG-12 ciclo 16→15 | fixo | dia de início do ciclo |
| RG-13 limites de ocorrência | 1 dia / 45 / 7 | três parâmetros |
| RG-18 setores | texto espalhado | tabela `setores` |

## 5. Marca branca e domínio
- SaaS: `empresa.<domínio-próprio>` por cliente (subdomínio), logo e cores vindos de `empresas`.
- Instalação dedicada: domínio do cliente; mesmo código, `empresa` única.
- Domínio pago próprio: registrar e apontar o DNS para a hospedagem escolhida (hoje GitHub Pages; para subdomínio por cliente será preciso hospedagem com curinga `*.dominio`, como Netlify/Cloudflare Pages/Vercel — decisão da Fase 2).

## 6. Dois modelos, um código
- Um único repositório e versão. A diferença entre SaaS e dedicada é **só implantação** (qual banco, qual domínio, quais configurações).
- Migrações de banco versionadas em `supabase/migrations/`, aplicáveis a todos os bancos em ordem.
- Atualização: SaaS = uma vez; dedicada = rodar o mesmo pacote de migrações e publicar a mesma versão no cliente.

## 7. Ordem segura para chegar lá
1. (Fase 0) `REGRAS.md`, testes das regras, esquema versionado — **feito neste PR**.
2. Fazer o código **ler** `turnos`/`config_sistema` em vez de números fixos, ainda para uma empresa só (sem mudar resultado; os testes provam).
3. Criar `empresas` + `empresa_id` (migração com backup; tudo recebe a empresa atual).
4. RLS por empresa + testes de isolamento.
5. Tela de configuração da empresa.
6. Primeira empresa nova de teste, com regras diferentes da Bomix, para provar que nada está fixo.

## 8. Cuidados
- Isolamento entre empresas é o maior risco de venda: testar com duas empresas antes de qualquer cliente real.
- Dados da Bomix pertencem à Bomix; ver o documento de transferência/venda do projeto (autoria, LGPD, contrato).
- Não migrar para Laravel/MySQL antes de ter as regras testadas (Fase 1): sem testes, a reescrita não tem como provar que os números continuam iguais.
