# Crônicas de Mesa

Gerenciador de campanhas de RPG: o Mestre define os campos da ficha, NPCs, links, documentos e moedas; os jogadores registram suas sessões com inventário e equipamentos. A IA (Google Gemini) sugere campos, gera descrições de NPCs, documentos e resumos de sessão.

> Os dados ainda ficam no `localStorage` do navegador, então Mestre e jogadores precisam usar o mesmo navegador por enquanto. A migração para um backend (Supabase) está planejada.

## Rodar localmente

**Pré-requisito:** Node.js 22+

1. Instale as dependências:
   `npm install`
2. Crie um arquivo `.env.local` com a sua chave do Gemini:
   `GEMINI_API_KEY=sua-chave`
3. Rode o app:
   `npm run dev`

Sem a chave o app funciona normalmente; só os recursos de IA mostram um aviso.

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

O `netlify.toml` já configura o build e a função. No painel do Netlify, em **Site configuration › Environment variables**, defina `GEMINI_API_KEY`.
