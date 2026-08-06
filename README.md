# Painel da Folha de Pagamento — São Miguel dos Campos

Site com link fixo que mostra a folha por secretaria/mês, e uma página `/upload`
onde você sobe um arquivinho `.json` (gerado pelo Claude, no chat) e o painel já
atualiza. **Sem custo**: o site só guarda e mostra números, não chama nenhuma IA —
a leitura dos PDFs continua acontecendo aqui na conversa, do jeito que já vínhamos
fazendo.

O site inteiro fica atrás de um login (e-mail + senha) — ninguém sem conta
consegue ver o painel nem a página de upload.

## Como está organizado

- `/login` — tela de entrada (e-mail + senha)
- `/` — o painel (só quem estiver logado consegue ver)
- `/upload` — onde você sobe o `.json` do mês (só quem estiver logado)
- Os dados ficam guardados no **Supabase** (banco de dados, plano gratuito)
- Quem faz login é o **Supabase Auth** (parte do mesmo Supabase, sem custo extra)
- O site fica no ar pela **Vercel** (hospedagem, plano gratuito)
- Não tem nenhuma chave de IA no site — zero custo de API

## Fluxo de todo mês

1. Você me manda os PDFs de Encargos e de Centro de Custo (das entidades que tiver) aqui no chat, como sempre.
2. Eu extraio os valores e monto o arquivo `atualizacao_MES_ANO.json`, e te devolvo pra baixar.
3. Você entra em `/upload` (logado), escolhe esse arquivo e clica em **Atualizar painel**.
4. Pronto — o painel principal já mostra os números novos, com o link de sempre.

## Passo a passo para colocar no ar (uma vez só)

### 1. Crie o banco de dados (Supabase) — grátis

1. Vá em [supabase.com](https://supabase.com) → crie uma conta grátis (pode ser com o Google) → **New project**.
2. Dê um nome (ex: `painel-smc`), escolha uma senha de banco (guarde, mas ela não vai para o site) e a região mais próxima (São Paulo).
3. Depois que o projeto for criado, vá em **SQL Editor** → **New query**.
4. Abra o arquivo `supabase/schema.sql` deste projeto, copie todo o conteúdo, cole ali e clique em **Run**. Isso cria as tabelas.
5. Vá em **Project Settings → API** (ou **API Keys**). Você vai precisar de 3 valores mais adiante:
   - **Project URL**
   - **anon public** key (ou "Publishable key", se seu projeto usa os nomes novos)
   - **service_role** key (ou "Secret key" — clique em "reveal", essa é secreta, não compartilhe)

O plano gratuito do Supabase aguenta muito mais dados e acessos do que este painel vai
usar — não deve gerar cobrança.

### 2. Crie os logins de quem vai acessar o site

1. No painel do Supabase, vá em **Authentication** (ícone de pessoa, no menu da esquerda) → **Users**.
2. Clique em **Add user → Create new user**.
3. Preencha e-mail e senha da pessoa. Marque a opção **Auto Confirm User** (assim ela já consegue entrar direto, sem precisar confirmar por e-mail — não configuramos envio de e-mail neste projeto).
4. Clique em **Create user**. Repita para cada pessoa que precisa acessar (você, o secretário, etc.).
5. Para tirar o acesso de alguém depois, é só voltar aqui e excluir o usuário.

### 3. Suba o código para o GitHub — grátis

1. Crie uma conta em [github.com](https://github.com) se ainda não tiver.
2. Crie um repositório novo (pode ser privado), ex: `painel-smc`.
3. Suba os arquivos desta pasta para esse repositório (pelo GitHub Desktop, ou arrastando os arquivos na própria página do GitHub em "uploading an existing file") — **mantendo as pastas** (`app/upload/page.js` precisa continuar dentro de `app/upload`, não pode virar um `page.js` solto).

### 4. Publique na Vercel — grátis

1. Vá em [vercel.com](https://vercel.com) → crie conta com o mesmo GitHub do passo anterior.
2. **Add New → Project** → escolha o repositório `painel-smc` → **Import**.
3. Antes de clicar em Deploy, abra **Environment Variables** e adicione, um por um (ou colando tudo de uma vez no campo Key, que a Vercel separa sozinha):

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | o Project URL do passo 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a anon public key do passo 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | a service_role key do passo 1 |

4. Clique em **Deploy**. Em 1-2 minutos o site está no ar, com um link tipo `painel-smc.vercel.app`.

O plano gratuito (Hobby) da Vercel também é mais que suficiente para este painel.

### Pronto

- Login: `https://painel-smc.vercel.app/login`
- Painel: `https://painel-smc.vercel.app`
- Upload: `https://painel-smc.vercel.app/upload`

## Se você já tinha publicado antes (com senha simples)

Esta versão troca a senha única (`UPLOAD_PASSWORD`) por login de verdade. Pra
atualizar um site que você já publicou:

1. Rode o arquivo `supabase/migration_auth.sql` no SQL Editor do Supabase (troca a regra de quem pode ler os dados).
2. Crie pelo menos um usuário seguindo o passo 2 acima.
3. Suba os arquivos novos/alterados para o GitHub (`middleware.js`, `lib/supabaseClient.js`, `lib/supabaseServer.js`, `app/login/page.js`, `app/api/upload/route.js`, `app/upload/page.js`, `app/page.js`, `package.json`).
4. Na Vercel, pode remover a variável `UPLOAD_PASSWORD` (Settings → Environment Variables) — ela não é mais usada.
5. A Vercel republica sozinha assim que detecta o novo commit.

## Formato do arquivo `.json` de atualização


Caso você queira montar um arquivo manualmente (ou eu gere fora do chat), o formato
esperado é uma lista de objetos, um por secretaria/mês/entidade:

```json
[
  {
    "entidade": "PREFEITURA",
    "codigo": "302",
    "secretaria": "SECRETARIA DE ADMINISTRACAO",
    "ano": 2026,
    "mesnum": 7,
    "bruto": 379974.03,
    "liquido": 297987.85,
    "encargos": 37259.52,
    "total": 417233.55,
    "func": 110
  }
]
```

`entidade` deve ser `PREFEITURA`, `DINAMICA` ou `COOPREV`. Enviar de novo uma
secretaria/mês/entidade que já existe substitui os valores antigos (não duplica).

## Domínio próprio (opcional)

Na Vercel, em **Settings → Domains**, dá para apontar um domínio da prefeitura
(ex: `folha.saomigueldoscampos.al.gov.br`) para o painel, se a prefeitura tiver um
domínio próprio. Isso exige acesso ao painel de DNS do domínio — geralmente quem
cuida disso é o setor de TI.

## Rodando localmente (opcional, para testar antes de publicar)

```bash
npm install
cp .env.example .env.local   # preencha com suas chaves do Supabase
npm run dev
```

Abra http://localhost:3000
