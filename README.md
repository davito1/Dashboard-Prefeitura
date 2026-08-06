# Painel da Folha de Pagamento — São Miguel dos Campos

Site com link fixo que mostra a folha por secretaria/mês, e uma página `/upload`
onde você sobe um arquivinho `.json` (gerado pelo Claude, no chat) e o painel já
atualiza. **Sem custo**: o site só guarda e mostra números, não chama nenhuma IA —
a leitura dos PDFs continua acontecendo aqui na conversa, do jeito que já vínhamos
fazendo.

## Como está organizado

- `/` — o painel (todo mundo com o link consegue ver, é só leitura)
- `/upload` — onde você sobe o `.json` do mês (protegido por senha)
- Os dados ficam guardados no **Supabase** (banco de dados, plano gratuito)
- O site fica no ar pela **Vercel** (hospedagem, plano gratuito)
- Não tem nenhuma chave de IA no site — zero custo de API

## Fluxo de todo mês

1. Você me manda os PDFs de Encargos e de Centro de Custo (das entidades que tiver) aqui no chat, como sempre.
2. Eu extraio os valores e monto o arquivo `atualizacao_MES_ANO.json`, e te devolvo pra baixar.
3. Você entra em `/upload`, escolhe esse arquivo, digita a senha e clica em **Atualizar painel**.
4. Pronto — o painel principal já mostra os números novos, com o link de sempre.

## Passo a passo para colocar no ar (uma vez só)

### 1. Crie o banco de dados (Supabase) — grátis

1. Vá em [supabase.com](https://supabase.com) → crie uma conta grátis (pode ser com o Google) → **New project**.
2. Dê um nome (ex: `painel-smc`), escolha uma senha de banco (guarde, mas ela não vai para o site) e a região mais próxima (São Paulo).
3. Depois que o projeto for criado, vá em **SQL Editor** → **New query**.
4. Abra o arquivo `supabase/schema.sql` deste projeto, copie todo o conteúdo, cole ali e clique em **Run**. Isso cria as tabelas.
5. Vá em **Project Settings → API**. Você vai precisar de 3 valores mais adiante:
   - **Project URL** https://dqsnvuxlnqqbkqkasrlj.supabase.co/rest/v1/
   - **anon public** key 
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxc252dXhsbnFxYmtxa2FzcmxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNDY2MDAsImV4cCI6MjEwMTYyMjYwMH0.nqa59h64Wfz8ejnegCK4zWjMALPQ9k1CQxxMpBvT0RA
   - **service_role** key (clique em "reveal" — essa é secreta, não compartilhe)
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxc252dXhsbnFxYmtxa2FzcmxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA0NjYwMCwiZXhwIjoyMTAxNjIyNjAwfQ.-QvUQymDWSZYv0GeGSIno9cXfMe_fNYhjmGsuGIQYw8

O plano gratuito do Supabase aguenta muito mais dados e acessos do que este painel vai
usar — não deve gerar cobrança.

### 2. Suba o código para o GitHub — grátis

1. Crie uma conta em [github.com](https://github.com) se ainda não tiver.
2. Crie um repositório novo (pode ser privado), ex: `painel-smc`.
3. Suba os arquivos desta pasta para esse repositório (pelo GitHub Desktop, ou arrastando os arquivos na própria página do GitHub em "uploading an existing file").

### 3. Publique na Vercel — grátis

1. Vá em [vercel.com](https://vercel.com) → crie conta com o mesmo GitHub do passo anterior.
2. **Add New → Project** → escolha o repositório `painel-smc` → **Import**.
3. Antes de clicar em Deploy, abra **Environment Variables** e adicione, um por um:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | o Project URL do passo 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a anon public key do passo 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | a service_role key do passo 1 |
   | `UPLOAD_PASSWORD` | uma senha à sua escolha, só para você |

4. Clique em **Deploy**. Em 1-2 minutos o site está no ar, com um link tipo `painel-smc.vercel.app`.

O plano gratuito (Hobby) da Vercel também é mais que suficiente para este painel.

### Pronto

- Painel: `https://painel-smc.vercel.app`
- Upload: `https://painel-smc.vercel.app/upload`

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
