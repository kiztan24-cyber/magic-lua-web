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
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
    }

    // Llamada directa a la API REST de Gemini (sin SDK)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;
    
    const systemPrompt = `Eres un experto en Roblox Luau. Genera SOLO código ejecutable sin explicaciones ni markdown.

Tarea: ${prompt}

REGLAS ESTRICTAS:
- NO uses \`\`\`lua ni \`\`\`
- Sin comentarios extensos
- Código directo para Roblox Studio`;

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
      return NextResponse.json({ 
        error: `Gemini Error: ${response.status}` 
      }, { status: 500 });
    }

    const data = await response.json();
    let luaCode = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpieza agresiva
    luaCode = luaCode
      .replace(/```lua\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Guardar en Redis
    await kv.set(`session:${sessionId}`, luaCode, { ex: 60 });

    console.log('✅ Script generado y guardado');
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error completo:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
