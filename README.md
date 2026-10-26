# Crônicas de Mesa

Gerenciador de campanhas de RPG: o Mestre define os campos da ficha, NPCs, links, documentos e moedas; os jogadores registram suas sessões com inventário e equipamentos. A IA (Google Gemini) sugere campos, gera descrições de NPCs, documentos e resumos de sessão.

Os dados ficam no [Supabase](https://supabase.com): cada pessoa tem sua conta, quem cria uma campanha é o Mestre dela, e os jogadores entram com o código de convite que aparece no painel do Mestre. As regras de acesso do banco garantem que o jogador só veja os NPCs que descobriu (nunca a descrição verdadeira) e os links liberados para ele.

## Configurar o Supabase (uma vez)

1. No painel do projeto, abra **SQL Editor › New query**, cole o conteúdo de [`supabase/migrations/001_inicial.sql`](supabase/migrations/001_inicial.sql) e clique em **Run**.
2. Em **Authentication › URL Configuration**, coloque o endereço do site no Netlify em **Site URL** (é para onde o link de confirmação de e-mail leva).
3. Opcional: em **Authentication › Sign In / Providers › Email**, desligue **Confirm email** se não quiser exigir confirmação por e-mail no cadastro.

## Rodar localmente

**Pré-requisito:** Node.js 22+

1. Instale as dependências:
   `npm install`
2. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `GEMINI_API_KEY`.
3. Rode o app:
   `npm run dev`

Sem a chave do Gemini o app funciona normalmente; só os recursos de IA mostram um aviso.

Se você usou a versão antiga (dados no navegador), a tela de campanhas oferece **Importar como Mestre** para levar campos, NPCs, links e moedas para o banco.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção em `dist/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos do TypeScript |
| `npm test` | Testes (Vitest) |

## IA e a chave da API

As chamadas ao Gemini são feitas no servidor, pela função `netlify/functions/gemini.ts` (o código fica em `server/gemini.ts`). Assim a chave nunca vai para o navegador. Em desenvolvimento, o próprio Vite responde no mesmo endereço usando esse código.

## Deploy no Netlify

O `netlify.toml` já configura o build e a função. No painel do Netlify, em **Site configuration › Environment variables**, defina `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `GEMINI_API_KEY`, e faça um novo deploy.
