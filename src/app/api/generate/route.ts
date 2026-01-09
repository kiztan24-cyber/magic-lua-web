import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { kv } from '@vercel/kv';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { prompt, sessionId } = await req.json();

    if (!prompt || !sessionId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    
    // Intentar con el modelo más reciente disponible
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-latest", // Usa el alias "latest"
    });

    const fullPrompt = `Eres un experto en Roblox Luau. Genera SOLO código Lua ejecutable, sin markdown ni explicaciones.

Tarea: ${prompt}

Reglas:
- NO uses \`\`\`lua ni \`\`\`
- Código directo y funcional
- Usa Instance.new(), task.wait(), etc`;

    const result = await model.generateContent(fullPrompt);
    let luaCode = result.response.text();

    // Limpieza
    luaCode = luaCode
      .replace(/```lua\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    await kv.set(`session:${sessionId}`, luaCode, { ex: 60 });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error Gemini:', error.message);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
