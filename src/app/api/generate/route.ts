import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { prompt, sessionId } = await req.json();

    if (!prompt || !sessionId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    // --- CAMBIO CRÍTICO: Usamos gemini-1.5-flash en v1beta ---
    // Esta es la ruta que FUNCIONA actualmente para cuentas gratuitas
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;

    const systemPrompt = `Eres un experto en Roblox Luau. Genera SOLO código ejecutable.
    Tarea: ${prompt}
    REGLAS: NO markdown, NO comentarios, usa API moderna.`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: systemPrompt }]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', response.status, errorText);
      // Devolvemos el error exacto para verlo en el log si falla
      return NextResponse.json({ error: errorText }, { status: 500 });
    }

    const data = await response.json();
    let luaCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpieza
    luaCode = luaCode.replace(/```lua\n?/g, '').replace(/```\n?/g, '').trim();

    await kv.set(`session:${sessionId}`, luaCode, { ex: 60 });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
