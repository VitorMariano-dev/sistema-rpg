// Netlify Function: todas as chamadas ao Gemini passam por aqui.
// A chave GEMINI_API_KEY fica só no servidor e só usuários logados no Supabase podem usar.
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const MODEL_NAME = 'gemini-2.5-flash';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type ResourceValue = { current: number; max: number };
type Field = { id: string; label: string; type: string };

const actions: Record<string, (ai: GoogleGenAI, payload: any) => Promise<unknown>> = {
  async suggestFields(ai, { theme }: { theme: string }) {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Estou construindo um sistema de registro de campanhas de RPG. O tema da minha campanha é: "${theme}". 
      Gere uma lista de 5 a 8 campos de formulário personalizados em Português que os jogadores devem preencher após uma sessão. 
      Inclua campos numéricos (como XP, Ouro) e campos de recurso (como Vida: 80/100, Mana) se apropriado.
      Para tipos de recursos (vida/mana/sanidade que tem máximo e atual), use o tipo RESOURCE.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING, description: 'O rótulo do campo de entrada' },
              type: { type: Type.STRING, enum: ['TEXT', 'TEXTAREA', 'NUMBER', 'CHECKBOX', 'RESOURCE'], description: 'O tipo de entrada' },
              placeholder: { type: Type.STRING, description: 'Um texto curto de exemplo (placeholder)' },
              description: { type: Type.STRING, description: 'Texto de ajuda para o jogador' },
            },
            required: ['label', 'type'],
          },
        },
      },
    });
    return { fields: JSON.parse(response.text || '[]') };
  },

  async summarizeSession(ai, { logData, fields }: { logData: Record<string, any>; fields: Field[] }) {
    const formattedData = fields.map(field => {
      const value = logData[field.id];
      if (field.type === 'RESOURCE' && value && typeof value === 'object') {
        const res = value as ResourceValue;
        return `${field.label}: ${res.current}/${res.max}`;
      }
      return `${field.label}: ${value}`;
    }).join('\n');

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Aqui estão os dados brutos de um registro de sessão de RPG. Escreva uma entrada de diário curta e dramática (máx. 150 palavras) resumindo esses eventos como se fossem escritos por um cronista, em Português do Brasil.\n\n${formattedData}`,
      config: { temperature: 0.8 },
    });
    return { text: response.text || 'Não foi possível gerar o resumo.' };
  },

  async npcDescriptions(ai, { name, context }: { name: string; context: string }) {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Crie descrições para um NPC/Monstro de RPG chamado "${name}". Contexto extra: "${context}".
      
      Preciso de dois textos distintos em Português:
      1. Descrição Pública: O que os jogadores veem imediatamente (aparência, cheiro, equipamento visível). Não revele segredos ou intenções ocultas.
      2. Descrição do Mestre: A verdade sobre o NPC (personalidade, segredos, intenções reais, natureza mágica se houver).
      
      Retorne APENAS o JSON.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gmDescription: { type: Type.STRING, description: 'A verdade oculta para o Mestre' },
            publicDescription: { type: Type.STRING, description: 'A descrição visual para os jogadores' },
          },
          required: ['gmDescription', 'publicDescription'],
        },
      },
    });
    const result = JSON.parse(response.text || '{}');
    return { gmDescription: result.gmDescription || '', publicDescription: result.publicDescription || '' };
  },

  async documentContent(ai, { keywords, type }: { keywords: string; type: string }) {
    let prompt = `Escreva o texto curto (máx 200 palavras) de um documento de RPG de fantasia (como uma carta, um decreto real, ou página de diário). 
    Use as seguintes palavras-chaves/ideias: "${keywords}".
    O tom deve ser imersivo. Não inclua introduções fora do personagem.`;
    if (type === 'MAP') {
      prompt = `Descreva detalhadamente um mapa antigo ou uma localidade baseada nestas palavras-chaves: "${keywords}".`;
    }
    const response = await ai.models.generateContent({ model: MODEL_NAME, contents: prompt });
    return { text: response.text || 'O documento está ilegível...' };
  },
};

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, 500);

  // Confere o usuário pelo token do Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return json({ error: 'Supabase não configurado no servidor.' }, 500);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Faça login para usar a IA.' }, 401);
  const { data: { user }, error: authError } = await createClient(supabaseUrl, supabaseKey).auth.getUser(token);
  if (authError || !user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401);

  let body: { action?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }
  const handler = body.action ? actions[body.action] : undefined;
  if (!handler) return json({ error: 'Ação desconhecida' }, 400);

  try {
    return json(await handler(new GoogleGenAI({ apiKey }), body.payload || {}));
  } catch (error) {
    console.error(`Gemini (${body.action}) falhou:`, error);
    return json({ error: 'Erro ao falar com a IA.' }, 502);
  }
};

export const config = { path: '/api/gemini' };
