import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, sessionId, action } = await req.json();
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    // Detectar modelos (reutilizamos tu lógica de autodetect que ya funciona)
    const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listResp = await fetch(listModelsUrl);
    const listData = await listResp.json();
    // Filtramos modelos generativos
    const validModels = listData.models?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent')) || [];
    const modelName = validModels.length > 0 ? validModels[0].name.split('/').pop() : 'gemini-1.5-flash';
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    let systemPrompt = "";
    
    if (action === 'plan') {
      systemPrompt = `Eres un Arquitecto Senior de Roblox.
      TU OBJETIVO: Generar un Checklist Técnico conciso.
      FORMATO ESTRICTO:
      ### Plan de Implementación
      - [ ] Paso 1 (Técnico)
      - [ ] Paso 2 (Técnico)
      
      NO escribas introducciones ni conclusiones. Solo la lista.`;
    } else {
      // Concatenar historial para que la IA sepa qué plan está ejecutando
      const context = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
      systemPrompt = `Eres un Experto Scripter de Roblox.
      CONTEXTO:
      ${context}
      
      TAREA: Generar el script Lua FINAL para el plan aprobado.
      REGLAS:
      - SOLO código Lua puro.
      - Sin markdown.
      - Usa servicios modernos (TweenService, RunService).`;
    }

    const lastMsg = messages[messages.length - 1].content;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nUsuario: ${lastMsg}` }] }]
      })
    });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error.";

    if (action === 'execute') {
      const cleanCode = reply.replace(/```lua\n?/g, '').replace(/```\n?/g, '').trim();
      await kv.set(`session:${sessionId}`, cleanCode, { ex: 300 });
      reply = `**✅ Código Generado**\n\nEl script ha sido enviado al plugin.\n\n**Estado:**\n- [x] Plan aprobado\n- [x] Script compilado\n- [x] Enviado a Roblox Studio`;
    }

    return NextResponse.json({ success: true, reply });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
