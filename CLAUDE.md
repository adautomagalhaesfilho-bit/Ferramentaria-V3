# CLAUDE.md — guia do projeto

Leia este arquivo primeiro. Ele diz o que o produto é, como está organizado e como se trabalha nele.

## Produto
Sistema de gestão de ferramentaria e usinagem de moldes de injeção: apontamento de tempo, metas e ocupação de pessoas e máquinas, produção e injetoras, PCM, RH, banco de horas, ficha e confiabilidade do molde (MTBF/MTTR), dashboards, exportações e integrações.

Vendido a **várias empresas**, em dois modelos com o mesmo código: **SaaS** (hospedamos) e **instalação dedicada** (ambiente do cliente). Cada empresa tem as próprias regras, definidas por **configuração na tela**, nunca por código. Nenhum nome de cliente aparece no código.

Dono do produto: Adauto (não é desenvolvedor). Ele decide, aprova e acompanha; a implementação é nossa. Falar em português simples; aprovar **texto de regra**, não código.

## Documentos (nesta ordem)
| Documento | Para quê |
|---|---|
| `docs/REGRAS.md` | **Fonte da verdade** das regras de negócio (RG-xx), parâmetros e casos de ouro |
| `docs/MULTIEMPRESA.md` | Isolamento, configuração por empresa, implantação, modelos de venda |
| `docs/ARQUITETURA.md` | Camadas, estrutura de pastas, dados, API, testes, segurança, marcos |
| `docs/perfis/` | Valores, regras específicas e casos de aceite de **cada empresa** (hoje `bomix.md`). `REGRAS.md` nunca cita empresa |
| `docs/LEGADO.md` | Onde o código atual (versão em produção) implementa cada regra e o plano de migração |

## Como trabalhar (especificação primeiro)
1. Entender o pedido em português.
2. Se mexe em regra: **editar `REGRAS.md`**, com parâmetro, vigência e caso de ouro, e **aprovar o texto com o Adauto**.
3. Escrever o teste a partir do caso de ouro.
4. Implementar no domínio (ou, enquanto o legado vive, no ponto indicado em `LEGADO.md`).
5. Rodar os testes. Conferir o resultado com números reais.
6. Branch → commit → pull request. **Merge somente quando o Adauto disser "faça o merge" citando o(s) PR(s).**

Ajustes visuais pequenos (alinhamento, cor, legenda): fazer direto. Regra ou dado: perguntar antes. Centralizar elementos e acertos parecidos ele já autorizou como padrão.

## Regras de ouro do código
- Regra de negócio vive no **domínio** (código puro, testável); tela só desenha; banco só guarda.
- **Uma regra, um lugar.** Antes de escrever uma conta, procurar se ela já existe.
- Valor que a empresa pode querer mudar (minutos de refeição, capacidade, setores, turnos) **é parâmetro**, não constante.
- Nada de `if (empresa === ...)`: particularidade vira parâmetro com vigência, registrado no perfil da empresa (`docs/perfis/`), não em `REGRAS.md`.
- Todo dado de negócio pertence a uma `empresa_id`; isolamento garantido no banco.
- Arquivo ≤ 300 linhas, função ≤ 40, linha ≤ 120 caracteres.
- Datas de negócio como `AAAA-MM-DD`; ao criar `Date` usar meio-dia (`T12:00:00`) para evitar erro de fuso. Fuso: o da empresa (hoje America/Sao_Paulo).
- Toda alteração relevante grava auditoria. Não apagar dado sem pedido explícito; correções diretas no banco também são registradas.
- Segredos só em cofre de segredos; nunca no código.
- Textos de tela em português do Brasil.
- Mudança de banco só por migração numerada (`supabase/migrations/`, enquanto a plataforma for Supabase).

## Fora do escopo sem pedido
- PR #64 (MTTR em tempo corrido) está aberto: **não mergear** até o Adauto voltar ao assunto.
- Decisão de plataforma (ADR-001 em `ARQUITETURA.md`) está em aberto até os casos de ouro estarem prontos.

## Estado de hoje
O que está em produção é a versão anterior ao desenho acima (site estático + Supabase). Mapa de arquivos, onde cada regra mora e plano de migração: **`docs/LEGADO.md`**. Ao mudar um `.js` do legado, subir o `?v=` dele em `app.html`.
