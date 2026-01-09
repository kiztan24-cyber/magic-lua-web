import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { kv } from '@vercel/kv';

// Configuración del timeout para Vercel
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { prompt, sessionId } = await req.json();

    if (!prompt || !sessionId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    // Verificar que la API Key existe
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      console.error('GOOGLE_GEMINI_API_KEY no está configurada');
      return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
    }

    // Inicializar Gemini con el modelo correcto
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    
    // Usar el modelo estable y disponible
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro", // Modelo estable disponible en todos los planes
    });

    // Prompt mejorado con instrucciones claras
    const fullPrompt = `
Eres un experto en Roblox Luau. Genera SOLO código ejecutable sin explicaciones.
REGLAS:
- NO uses markdown (\`\`\`lua o \`\`\`)
- NO agregues comentarios extensos
- Usa la API moderna de Roblox (Instance.new, task.wait, etc)
- El código se ejecutará en ServerStorage

Tarea del usuario: ${prompt}
`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    let luaCode = response.text();

    // Limpieza agresiva de markdown y espacios
    luaCode = luaCode
      .replace(/```lua\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Guardar en Redis con TTL de 60 segundos
    await kv.set(`session:${sessionId}`, luaCode, { ex: 60 });

    return NextResponse.json({ 
      success: true, 
      message: "Script generado y enviado" 
    });

  } catch (error: any) {
    // Log detallado para debug
    console.error('Error completo:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    
    return NextResponse.json({ 
      error: 'Error generando script',
      details: error.message 
    }, { status: 500 });
  }
}
