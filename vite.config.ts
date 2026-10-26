import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Em desenvolvimento, responde em /.netlify/functions/gemini usando o mesmo código da
// Netlify Function, para que `npm run dev` funcione sem o Netlify CLI.
const geminiDevApi = (env: Record<string, string>): Plugin => ({
  name: 'gemini-dev-api',
  configureServer(server) {
    server.middlewares.use('/.netlify/functions/gemini', async (req, res) => {
      const send = (status: number, body: unknown) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
      };
      if (req.method !== 'POST') return send(405, { error: 'Método não permitido.' });

      let raw = '';
      for await (const chunk of req) raw += chunk;
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(400, { error: 'JSON inválido.' });
      }

      const { handleGeminiRequest, getApiKey } = await server.ssrLoadModule('/server/gemini.ts');
      const result = await handleGeminiRequest(body, getApiKey({ ...process.env, ...env }));
      send(result.status, result.body);
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), geminiDevApi(env)],
  }
})
