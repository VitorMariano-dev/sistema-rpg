# Crônicas de Mesa

Gerenciador de campanhas de RPG: o **Mestre** define a estrutura da campanha (campos da ficha, NPCs, links, moedas) e os **jogadores** registram suas sessões. O Gemini sugere campos, gera NPCs, documentos e o "Resumo do Cronista".

- **Front-end:** React + Vite + Tailwind, hospedado na Netlify.
- **Login e banco:** Supabase (Auth + Postgres com Row Level Security + Realtime).
- **IA:** Gemini chamado por uma Netlify Function (`netlify/functions/gemini.mts`). A chave nunca vai para o navegador.

## Como funciona o acesso

- Cada pessoa cria a própria conta (e-mail, nome de usuário e senha).
- Quem **cria** uma campanha é o Mestre dela. O painel mostra um **código de convite**; os jogadores entram com esse código.
- As regras ficam no banco (`supabase/migrations/0001_init.sql`):
  - só o Mestre edita a campanha, NPCs e links;
  - a descrição verdadeira dos NPCs fica numa tabela que só o Mestre lê;
  - jogadores só recebem os NPCs que descobriram e os links liberados para eles;
  - cada um só registra sessões em seu próprio nome; o autor ou o Mestre pode excluir.
- Mudanças aparecem em tempo real para todos que estão com a campanha aberta.

## Configuração (uma vez)

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor**, cole o conteúdo de `supabase/migrations/0001_init.sql` e rode.
3. Em **Authentication > URL Configuration**, coloque a URL do site na Netlify em *Site URL* (é para lá que o link de confirmação de e-mail leva).
4. Opcional: em **Authentication > Sign In / Providers > Email**, desligue *Confirm email* se quiser que os jogadores entrem sem confirmar o e-mail.
5. Em **Project Settings > API**, copie a *Project URL* e a chave *anon public*.

### 2. Netlify

Em **Site configuration > Environment variables**, crie:

| Variável | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL do Supabase |
| `VITE_SUPABASE_ANON_KEY` | chave *anon public* do Supabase |
| `GEMINI_API_KEY` | chave do [Google AI Studio](https://aistudio.google.com/apikey) |

Se existir uma variável antiga `API_KEY`, pode apagar. Depois faça um novo deploy (**Deploys > Trigger deploy**), porque as variáveis `VITE_` entram no build.

O `netlify.toml` já define o build (`npm run build`, pasta `dist`) e a pasta das funções.

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencha os três valores
npx netlify dev        # front + função do Gemini em http://localhost:8888
```

`npm run dev` também funciona, mas sem a função: as ações de IA vão falhar.

## Dados antigos

A versão anterior guardava tudo no `localStorage` do navegador. Ao criar uma campanha no navegador onde esses dados existem, o app oferece importar campos, NPCs, links e moedas. Os registros de sessão antigos não são importados.
