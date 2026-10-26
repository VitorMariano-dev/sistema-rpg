import { handleGeminiRequest, getApiKey } from '../../server/gemini';

// Netlify Function servida em /.netlify/functions/gemini
export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método não permitido.' }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const { status, body: responseBody } = await handleGeminiRequest(body, getApiKey(process.env));
  return Response.json(responseBody, { status });
};
