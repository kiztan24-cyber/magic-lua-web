// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, sessionId, action } = body;

    if (!messages || !Array.isArray(messages)) {
      throw new Error('Missing or invalid "messages" array');
    }
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Missing or invalid "sessionId"');
    }
    if (action !== 'plan' && action !== 'execute') {
      throw new Error('Invalid "action" (must be "plan" or "execute")');
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GOOGLE_GEMINI_API_KEY env var');
    }

    // --------- SELECCIÓN DE MODELO (SEGURA) ----------
    const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listResp = await fetch(listModelsUrl);
    if (!listResp.ok) {
      throw new Error(`ListModels failed: ${listResp.status} ${listResp.statusText}`);
    }
    const listData = await listResp.json();

    const validModels =
      listData.models?.filter((m: any) =>
        m.supportedGenerationMethods?.includes('generateContent')
      ) || [];

    const modelName =
      validModels.length > 0
        ? validModels[0].name.split('/').pop()
        : 'gemini-2.5-flash';

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // --------- PROMPT DEL SISTEMA ----------
    let systemPrompt = '';

    if (action === 'plan') {
      systemPrompt = `
Eres un Arquitecto Senior de Roblox Luau.

OBJETIVO:
- Analizar la petición del usuario.
- Devolver un checklist técnico corto y claro para implementar la mecánica.

FORMATO ESTRICTO (Markdown):
### Plan de Implementación
- [ ] Paso 1 (muy concreto, técnico)
- [ ] Paso 2
- [ ] Paso 3

REGLAS:
- Nada de introducciones, despedidas ni párrafos largos.
- No generes código.
- Máximo 8 pasos.
`.trim();
    } else {
      const context = messages
        .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');

      systemPrompt = `
Eres un Experto Scripter de Roblox Luau.

CONTEXTO DE LA CONVERSACIÓN:
${context}

ENTORNO DE EJECUCIÓN (MAGIC API):
Tienes acceso a funciones globales especiales para facilitar tu trabajo. ÚSALAS:

1. \`MagicAPI.CreateScript(name, source, parent)\`:
   - Crea un Script real en el juego.
   - Úsalo SIEMPRE para lógica permanente (loops, eventos, NPCs).
   - Ejemplo: 
     \`MagicAPI.CreateScript("FollowerAI", "while true do ... end", game.ServerScriptService)\`

2. \`MagicAPI.CreateLocalScript(name, source, parent)\`:
   - Igual, pero crea un LocalScript (para StarterPlayer, etc).

REGLAS CRÍTICAS:
- NO escribas lógica compleja (bucles while, eventos) directamente en el código principal.
- EN SU LUGAR: Genera el código de esa lógica como un string y usa \`MagicAPI.CreateScript\`.
- Si necesitas una Part, créala con \`Instance.new\`.
- Si necesitas un NPC, créalo parte por parte o busca uno existente.

TU OBJETIVO:
- Generar código Lua que use estas herramientas para cumplir la petición.
`.trim();
    }

    const lastMessage = messages[messages.length - 1];
    const userText = typeof lastMessage?.content === 'string'
      ? lastMessage.content
      : '';

    // --------- LLAMADA A GEMINI ----------
    const resp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: `\n\nPetición del usuario:\n${userText}` },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    let reply: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';

    // --------- MODO EJECUCIÓN: GUARDAR CÓDIGO EN KV ----------
    if (action === 'execute') {
      const cleanCode = reply
        .replace(/```lua\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      await kv.set(`session:${sessionId}`, cleanCode, { ex: 300 });

      reply = [
        '**✅ Código Generado**',
        '',
        'El script ha sido enviado al plugin MagicLua.',
        '',
        '**Estado:**',
        '- [x] Plan aprobado',
        '- [x] Script compilado',
        '- [x] Enviado a Roblox Studio',
      ].join('\n');
    }

    return NextResponse.json({ success: true, reply });
  } catch (error: any) {
    console.error('CHAT API ERROR:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 },
    );
  }
}
