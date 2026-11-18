# MULTIEMPRESA.md — um produto, várias empresas

## 1. Objetivo
Um único produto atende várias empresas, cada uma com suas próprias regras, setores, turnos e identidade visual, sem alterar código. Dois modelos de venda com o **mesmo código e a mesma versão**:

| Modelo | Como funciona | Diferença |
|---|---|---|
| **SaaS** | Nós hospedamos. Várias empresas no mesmo ambiente, cada uma isolada. Cobrança por assinatura. | uma implantação, uma atualização para todas |
| **Instalação dedicada** | Ambiente próprio de um cliente (banco, domínio e chaves só dele). | mesmo pacote, implantado separado; migrações aplicadas pelo mesmo procedimento |

Regra de ouro: **a diferença entre os dois modelos é só implantação**. Nenhuma funcionalidade existe em um e não no outro.

## 2. Isolamento (o requisito mais importante)
- Toda tabela de negócio tem `empresa_id` obrigatório.
- Toda leitura e escrita é filtrada pela empresa do usuário **no banco** (política de acesso por linha), não só na tela. Esquecer um filtro no código não pode vazar dados.
- Usuário pertence a uma empresa. O papel **super administrador** (equipe do produto) é separado e auditado; opera suporte sem ver dados de negócio, salvo autorização registrada.
- Testes de isolamento rodam a cada versão com duas empresas: nenhum dado de uma aparece para a outra, em nenhuma tabela, função, exportação ou API.
- Arquivos (anexos, imagens) ficam em pastas por empresa com acesso restrito.

## 3. Configuração em vez de código
Camadas de regra (detalhe em `REGRAS.md`):

| Nível | Quem decide | Onde fica |
|---|---|---|
| Padrão | o produto | código |
| Parâmetro | o administrador da empresa | configuração da empresa |
| Específica | uma empresa, com data de início | configuração com vigência |

Princípios:
1. O código contém **mecanismos**; os **valores** vêm da configuração.
2. Nunca existe `if (empresa == X)`. Uma particularidade vira parâmetro com vigência.
3. Todo parâmetro tem **valor inicial de fábrica**, **vigência** (vale a partir de) e **histórico** de quem mudou.
4. Mudar parâmetro vale daqui para frente; períodos já fechados não se alteram.
5. Se três empresas pedem a mesma particularidade, ela vira recurso do produto.

### Parâmetros por empresa (resumo)
- Identidade: nome, logotipo, cores, fuso horário, idioma, domínio.
- Calendário: feriados, ciclo de fechamento mensal.
- Turnos: nome, horário, intervalo, tipo de escala (semanal ou rodízio), capacidade, turmas.
- Setores: nome, lança apontamento?, entra em meta?, início do tempo produtivo, ajustes de capacidade.
- Refeição: direito por turno, limite mínimo do dia.
- Hora extra automática: ligada?, horário, janela de dias.
- Isentos de meta: cargos e setores.
- Confiabilidade: limites de agrupamento de ocorrência.
- Cadastros: tipos de serviço, motivos de parada, categorias, máquinas, moldes.
- Perfis e permissões por setor e por tela.
- Integrações: chaves de API, webhooks, importações (RH).

## 4. Tela de configuração
Administrador da empresa acessa **Configurações**: cada grupo acima em uma página, com valor atual, vigência, histórico e botão "restaurar padrão". Alterações pedem confirmação e geram auditoria. Há **pré-visualização do efeito** quando possível ("com este valor, a meta de outubro seria X em vez de Y").

## 5. Implantação de uma nova empresa (onboarding)
1. Criar a empresa (nome, fuso, marca).
2. Aplicar o **modelo de configuração** (conjunto inicial de turnos, setores e regras; ex.: "Usinagem de moldes").
3. Criar o administrador da empresa.
4. Importar pessoas (planilha ou integração com o RH, por matrícula), feriados e máquinas.
5. Conferir com **casos de teste da empresa**: o cliente informa 3 dias reais e o resultado calculado é comparado ao que ele espera.
6. Liberar usuários.

## 6. Marca e domínio
- SaaS: endereço por empresa (`empresa.dominio-do-produto`), com logotipo e cores da empresa.
- Dedicada: domínio do cliente, mesmo código.
- Domínio próprio do produto, certificado e e-mail institucional fazem parte da configuração de implantação.

## 7. Planos e limites (a definir)
Itens que o produto deve conseguir medir por empresa: usuários ativos, pessoas cadastradas, máquinas, volume de apontamentos, armazenamento, chamadas de API e uso de IA. Preço e franquias são decisão comercial.

## 8. Dados, privacidade e saída
- Cada empresa é dona dos seus dados. Exportação completa (planilhas e arquivo estruturado) a qualquer momento.
- Encerramento: retenção definida em contrato, depois exclusão comprovada.
- Conformidade com a LGPD: base legal, registro de acessos, perfil de menor privilégio, backup criptografado.
- Dados pessoais de funcionários usados só para a finalidade do produto.

## 9. Critérios de pronto
O produto está pronto para multiempresa quando:
1. duas empresas com regras diferentes (turnos, almoço, setores) convivem e cada uma obtém o resultado esperado nos casos de ouro;
2. o teste de isolamento passa em todas as tabelas e na API;
3. uma empresa nova entra no ar só por configuração, sem alterar código;
4. uma atualização é aplicada em SaaS e em instalação dedicada pelo mesmo procedimento.
