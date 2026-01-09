import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const maxDuration = 60; // Más tiempo para generar código

export async function POST(req: Request) {
  try {
    const { prompt, plan, sessionId } = await req.json(); // Recibimos el PLAN también

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const systemPrompt = `Eres un experto en Roblox Luau.
    CONTEXTO: El usuario aprobó el siguiente plan de implementación:
    ${plan}
    
    TAREA: Escribe el script Lua completo y funcional para realizar este plan.
    REGLAS:
    - SOLO código Lua. Sin explicaciones ni markdown.
    - Usa Instance.new, task.wait, y servicios modernos.
    - Todo en un solo script (ServerScript).`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt}\n\nPetición original: ${prompt}` }]
        }]
      })
    });

    const data = await response.json();
    let luaCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Limpieza
    luaCode = luaCode.replace(/```lua\n?/g, '').replace(/```\n?/g, '').trim();

    await kv.set(`session:${sessionId}`, luaCode, { ex: 120 }); // 2 minutos de vida

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
