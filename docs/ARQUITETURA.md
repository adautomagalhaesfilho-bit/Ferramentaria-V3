# ARQUITETURA.md — arquitetura do produto

## 1. Princípios
1. **Regras separadas de tela e de banco.** O cálculo (almoço, meta, escala, ocorrência) é código puro, sem acesso a banco nem a tela. Testável sozinho.
2. **Uma regra, um lugar.** Cada regra de `REGRAS.md` existe uma única vez no sistema (nada de cópia em SQL, em tela e em relatório).
3. **API primeiro.** A interface web usa a mesma API que os clientes e integradores usam.
4. **Multiempresa desde o início.** Isolamento no banco (ver `MULTIEMPRESA.md`).
5. **Configuração, não código.** Valores vêm da configuração da empresa com vigência.
6. **Arquivos pequenos e previsíveis.** Facilita manutenção humana e por IA: custa menos para ler, alterar e conferir.
7. **Tudo auditado, tudo reversível.** Alteração de dado gera registro; mudança de banco só por migração versionada.
8. **Estável e simples antes de sofisticado.** Preferir tecnologia comum, bem documentada e hospedável por qualquer cliente.

## 2. Visão em camadas
```
 Interface web (PWA)  ·  Clientes de API  ·  Integrações (RH, ERP, BI, máquinas)
                       │  API REST v1 (OpenAPI) + webhooks
 ┌─────────────────────▼─────────────────────────────────────────────┐
 │ Aplicação (casos de uso): "registrar apontamento", "fechar mês"…   │
 ├────────────────────────────────────────────────────────────────────┤
 │ Domínio (regras puras): tempo, escala, almoço, meta, ocupação,     │
 │ banco de horas, confiabilidade — sem banco, sem tela, sem relógio  │
 ├────────────────────────────────────────────────────────────────────┤
 │ Infraestrutura: banco, autenticação, arquivos, agendador, e-mail   │
 └────────────────────────────────────────────────────────────────────┘
```
Dependências só apontam para dentro: interface → aplicação → domínio. O domínio não conhece ninguém.

## 3. Estrutura do código (alvo)
```
src/
  dominio/            regras puras, uma pasta por assunto
    tempo/            união de intervalos, minutos, virada de dia
    escala/           dias de trabalho, rodízio, feriados
    refeicao/         regra de refeição (RG-08)
    meta/             capacidade, meta, ocupação
    banco-horas/      saldo, hora extra
    confiabilidade/   ocorrência, MTBF, MTTR
  aplicacao/          casos de uso (orquestram domínio + dados)
  infra/
    banco/            repositórios (único acesso a dados), migrações
    auth/  arquivos/  agendador/  auditoria/
  api/                rotas v1, validação, chaves de API, webhooks
  web/                telas, componentes, estilos
  config/             leitura e validação da configuração por empresa
tests/
  dominio/            casos de ouro de REGRAS.md
  isolamento/         duas empresas não se enxergam
  api/                contrato OpenAPI
docs/                 REGRAS · MULTIEMPRESA · ARQUITETURA · DECISOES
```
Limites de qualidade: arquivo ≤ 300 linhas; função ≤ 40 linhas; linha ≤ 120 caracteres; nenhuma regra de negócio em `web/`; nenhum acesso a banco fora de `infra/banco/`.

## 4. Dados
- Banco relacional (hoje Postgres). Chaves, integridade referencial e restrições declaradas no banco.
- Pessoas e moldes referenciados por **id**, nunca por nome em texto livre.
- `empresa_id` em todas as tabelas; índices por empresa.
- Políticas de acesso por linha ligadas em todas as tabelas, com teste automático que falha se alguma tabela ficar sem política.
- Configuração: `config_empresa(empresa_id, chave, valor, vigente_desde, vigente_ate)`.
- Histórico em vez de sobrescrever: turno da pessoa, capacidade da máquina, parâmetros.
- Datas de negócio como data (sem hora); instantes em UTC com o fuso da empresa para exibir.
- Migrações numeradas e imutáveis (`NNNN_descricao`), aplicáveis em qualquer ambiente.

## 5. API e integrações
- **REST v1** versionada, documentada em **OpenAPI**; erros padronizados; paginação; filtros por data.
- **Autenticação:** usuário (sessão) e **chave de API por empresa** com escopos (leitura, escrita) e limite de uso.
- **Recursos iniciais:** pessoas, turnos, apontamentos, moldes, máquinas, ocorrências, indicadores (meta, ocupação, MTBF/MTTR), banco de horas.
- **Webhooks de saída:** novo apontamento, parada, molde concluído, hora extra pendente.
- **Importadores:** RH por **matrícula** (planilha ou API), feriados, moldes, máquinas.
- **Exportadores:** Excel/CSV, conexão somente leitura para BI.
- **Máquinas/CLP:** entrada de status de máquina por endpoint, alimentando ocorrências.
- **SSO** opcional para clientes maiores.
- **Assistente de IA:** somente leitura, limitado à empresa, com custo e uso medidos por empresa.

## 6. Interface
- Aplicativo web instalável (PWA), usável em celular e computador.
- Componentes pequenos e reutilizáveis; nenhum cálculo de regra na tela.
- Acessibilidade, português do Brasil, outros idiomas por arquivo de tradução.
- Marca da empresa (logotipo e cores) aplicada por configuração.

## 7. Qualidade e testes
- **Casos de ouro** de `REGRAS.md` viram testes do domínio: cada regra com exemplos numéricos.
- Testes de isolamento entre empresas e de contrato da API.
- Integração contínua: nada entra sem testes verdes.
- Teste visual das telas principais.
- Dados de demonstração geráveis por comando, sem dados reais.

## 8. Segurança e operação
- Segredos somente em cofre de segredos; nunca no código nem no navegador.
- Menor privilégio; senha forte e verificação de senha vazada; sessão com expiração.
- Backups automáticos diários, **restauração testada** periodicamente.
- Monitoramento de erros e de desempenho; alertas.
- Registro de acessos e de ações administrativas.
- Ambientes separados: desenvolvimento, homologação, produção.
- Publicação automatizada com possibilidade de voltar à versão anterior.

## 9. Convenções para trabalho com IA
Alterar uma regra deve custar poucas leituras:
1. Ler `REGRAS.md` (o que muda) → o arquivo de domínio da regra → o teste dela.
2. Os testes provam que nada ao redor quebrou; não é preciso ler a aplicação inteira.
3. Cada pasta tem um `LEIAME.md` curto com responsabilidade e arquivos principais.
4. Mudança de regra = um pull request com: texto da regra, casos de ouro, código.

## 10. Decisões registradas (ADR)
Cada decisão técnica relevante vira uma nota curta em `docs/decisoes/NNNN-titulo.md` (contexto, decisão, consequências). Abertas hoje:
- **ADR-001 Plataforma de execução:** definir a base técnica (linguagem, banco gerenciado ou próprio, hospedagem) após os casos de ouro prontos; critérios: facilidade de implantação dedicada, custo, segurança, ecossistema, exigências de clientes.
- **ADR-002 Hospedagem com subdomínio por empresa.**
- **ADR-003 Modelo de planos e limites.**

## 11. Marcos
1. **Especificação:** regras, casos de ouro, multiempresa, arquitetura (este conjunto).
2. **Núcleo de domínio testado:** tempo, escala, refeição, meta, banco de horas, confiabilidade.
3. **Dados e API:** esquema multiempresa, migrações, API v1 e chaves.
4. **Interface:** telas sobre a API, configurações por empresa.
5. **Integrações e operação:** importadores, webhooks, backups, monitoramento.
6. **Piloto com duas empresas** de regras diferentes e abertura comercial.
