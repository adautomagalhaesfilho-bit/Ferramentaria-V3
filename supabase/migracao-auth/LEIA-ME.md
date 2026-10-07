# Migração do login para o Supabase Auth — passo a passo

Objetivo: parar de deixar o banco aberto para qualquer pessoa que tenha o link do
app. Hoje a chave que está no código (`anon`) lê e altera **todas** as tabelas,
inclusive a de usuários com os hashes das senhas. Depois da migração, só quem
fizer login pelo Supabase Auth acessa os dados.

O que **não** muda para quem usa o sistema: o nome de usuário, os perfis
(admin, gestor, supervisor, pcm, técnico, operador), as permissões marcadas na
tela de Usuários e todas as telas do app.

O que muda: **as senhas**. O Supabase Auth não consegue aproveitar as senhas
antigas (o formato SHA-256 sem "sal" usado hoje não é aceito), então o admin
define uma senha inicial para cada pessoa e cada uma troca depois em
**🔑 Trocar senha**. A senha nova precisa ter **no mínimo 6 caracteres**.

---

## Arquivos

| Arquivo | O que faz | Risco |
|---|---|---|
| `01_preparacao.sql` | Acrescenta colunas, funções e políticas novas. Não remove nada. | Nenhum: o app atual continua igual. |
| `02_corte_anon.sql` | Remove o acesso de quem não fez login. | Quem estiver no app **antigo** para de ver dados. Tem trava: se faltar conta para algum usuário ativo, não faz nada. |
| `02_rollback_volta_anon.sql` | Desfaz o `02` (emergência). | Volta à situação de hoje. |
| `03_limpeza_senhas_antigas.sql` | Apaga a coluna com as senhas antigas. Opcional, semanas depois. | Depois disso não dá para voltar ao login antigo. |

Todos são rodados no painel do Supabase → **SQL Editor** → colar o conteúdo → **Run**.

---

## Ordem de aplicação (sem parar a produção)

### Etapa 0 — Antes de começar
- [ ] Confirme que existe backup recente: painel → **Database → Backups**.
- [ ] Escolha um horário de pouco movimento (ex.: troca de turno) para a **Etapa 3**.
      As etapas 1 e 2 podem ser feitas a qualquer hora.

### Etapa 1 — Preparar o banco (ninguém percebe)
- [ ] SQL Editor → rodar **`01_preparacao.sql`**.
- [ ] Abrir o app atual e conferir que tudo continua normal.

### Etapa 2 — Criar as 9 contas no Auth (ninguém percebe)

**2.1. Fechar o cadastro público** (obrigatório — senão qualquer pessoa poderia
criar uma conta pelo endereço do Supabase):
- painel → **Authentication → Sign In / Providers** (em versões antigas: *Providers / Settings*)
- desligar **"Allow new users to sign up"** → **Save**
- deixar o provedor **Email** ligado.

**2.2. Criar cada conta**: painel → **Authentication → Users → Add user → Create new user**
- **Email**: exatamente como na tabela abaixo
- **Password**: uma senha inicial (mín. 6 caracteres) — anote para entregar à pessoa
- marcar **"Auto Confirm User"** (assim nenhum e-mail é enviado)

| Usuário no app | Perfil | E-mail da conta no Auth |
|---|---|---|
| Admin | admin | `admin@ferramentaria.local` |
| Diogo.leonam | pcm | `diogo.leonam@ferramentaria.local` |
| Vanildo.Azevedo | gestor | `vanildo.azevedo@ferramentaria.local` |
| Jeferson.Diniz | supervisor | `jeferson.diniz@ferramentaria.local` |
| Adauto.Filho | supervisor | `adauto.filho@ferramentaria.local` |
| Pascoal.lopez | supervisor | `pascoal.lopez@ferramentaria.local` |
| Igor.Azevedo | supervisor | `igor.azevedo@ferramentaria.local` |
| Bancada | operador | `bancada@ferramentaria.local` |
| Breno.Vasconselos | supervisor | `breno.vasconselos@ferramentaria.local` |

A regra é sempre: **nome do usuário em minúsculas + `@ferramentaria.local`**.
Esses e-mails não existem de verdade e não precisam existir — servem só de
"login". A pessoa continua digitando só o nome (ex.: `Diogo.leonam`) na tela de
entrada.

> Se o painel recusar o domínio `ferramentaria.local`, use um domínio da empresa
> (ex.: `ferramentaria.suaempresa.com.br`) e troque o texto `ferramentaria.local`
> em **3 lugares**: `DOMINIO_LOGIN` em `js/supabase.js` e as duas ocorrências em
> `01_preparacao.sql` (depois rode o `01` de novo — ele pode ser repetido).

**2.3. Conferir o vínculo** — o banco liga cada conta ao usuário automaticamente
no momento em que a conta é criada. Para conferir, rode no SQL Editor:

```sql
select u.nome, u.perfil, u.ativo, u.email_login,
       case when u.auth_user_id is null then 'FALTA CONTA' else 'ok' end as vinculo
  from public.usuarios u order by u.nome;
```

Todos os ativos devem aparecer como `ok`. Se algum ficou como `FALTA CONTA`,
o e-mail foi digitado diferente do nome. Corrija o e-mail no Auth ou rode
(trocando os dois valores):

```sql
update public.usuarios u
   set auth_user_id = a.id, email_login = a.email
  from auth.users a
 where a.email = 'email.da.conta@ferramentaria.local'
   and u.nome  = 'Nome.No.App';
```

### Etapa 3 — Publicar o app novo (todos fazem login de novo uma vez)
- [ ] Fazer o merge do pull request (o app novo entra no ar).
- [ ] Avisar a equipe: *"entre com o mesmo usuário e a senha nova que eu passei;
      depois troque em 🔑 Trocar senha"*.
- [ ] Testar você mesmo: login, lançar um apontamento, enviar uma foto, abrir o
      dashboard, abrir a tela de Usuários como admin.

Nesta etapa o banco aceita **os dois jeitos** (antigo e novo), então:
- quem ainda estiver com o app antigo aberto continua trabalhando normalmente;
- **se algo der errado, basta reverter o pull request** e tudo volta a ser como hoje.

### Etapa 4 — Fechar a porta (o ganho de segurança acontece aqui)
Espere alguns dias, até que **todos** já tenham entrado no app novo. Para conferir:

```sql
select u.nome, a.last_sign_in_at
  from public.usuarios u
  left join auth.users a on a.id = u.auth_user_id
 where u.ativo order by a.last_sign_in_at nulls first;
```

Quando todos tiverem data em `last_sign_in_at`:
- [ ] SQL Editor → rodar **`02_corte_anon.sql`**.
- [ ] Testar de novo: login, lançamento, foto, dashboard.
- [ ] **Se algo parar de funcionar**: rodar `02_rollback_volta_anon.sql` (volta na
      hora) e me chamar com a mensagem de erro.

### Etapa 5 — Limpeza (opcional, semanas depois)
- [ ] Rodar `03_limpeza_senhas_antigas.sql` para apagar os hashes das senhas antigas.

---

## Depois da migração: como cadastrar um usuário novo

1. No app, tela **Usuários → Novo**: nome, perfil, setor, permissões (não há mais
   campo de senha). A tela mostra o e-mail que a conta deve ter.
2. No painel do Supabase → **Authentication → Users → Add user**, com esse e-mail,
   uma senha inicial e **Auto Confirm User** marcado.

Pode ser feito em qualquer ordem: o vínculo é automático nos dois sentidos.

- **Esqueceu a senha**: painel → Authentication → Users → clicar no usuário →
  definir nova senha (ou excluir e recriar a conta com o mesmo e-mail e rodar o
  `update` de vínculo da Etapa 2.3).
- **Desligar alguém**: desmarque **Usuário Ativo** no app. A pessoa perde acesso
  aos dados na hora, mesmo que ainda esteja logada.
- **Renomear um usuário** no app não muda o login dele: ele continua entrando
  com o e-mail original (aparece na lista de Usuários).

---

## O que ainda fica para uma próxima etapa

- As permissões finas (quem vê qual menu, quem pode editar) continuam sendo
  controladas **pelo app**. O banco passa a exigir login e usuário ativo, e só o
  admin pode alterar a tabela de usuários — mas um usuário logado que saiba
  mexer nas ferramentas do navegador ainda conseguiria ler/alterar tabelas fora
  dos menus dele. Levar cada permissão para dentro do banco é o próximo passo,
  tabela por tabela.
- As fotos dos buckets `molde-anexos` e `rh-anexos` continuam abertas para
  **leitura** por quem tiver o link (enviar fotos passa a exigir login).
