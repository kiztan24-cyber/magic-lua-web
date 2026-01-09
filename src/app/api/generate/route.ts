// En tu route.ts, reemplaza TODO con esto para auto-detectar modelos disponibles
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { prompt, sessionId } = await req.json();

    if (!prompt || !sessionId) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API Key missing' }, { status: 500 });

    // 1. OBTENER LISTA DE MODELOS DISPONIBLES (debug)
    const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listResponse = await fetch(listModelsUrl);
    const listData = await listResponse.json();
    console.log('Modelos disponibles:', listData.models?.map((m: any) => m.name) || 'Ninguno');

    // 2. USAR EL PRIMERO DISPONIBLE (auto-detect)
    const availableModels = listData.models || [];
    if (availableModels.length === 0) {
      return NextResponse.json({ error: 'No models available for your API key' }, { status: 500 });
    }
    const modelName = availableModels[0].name.split('/').pop()!; // e.g. "gemini-1.5-pro"
    console.log('Usando modelo:', modelName);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const systemPrompt = `Roblox Luau experto. SOLO código, sin markdown: ${prompt}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini Error:', errorText);
      return NextResponse.json({ error: errorText }, { status: 500 });
    }

    const data = await response.json();
    let luaCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    luaCode = luaCode.replace(/```lua\n?/g, '').replace(/```\n?/g, '').trim();

    await kv.set(`session:${sessionId}`, luaCode, { ex: 60 });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
