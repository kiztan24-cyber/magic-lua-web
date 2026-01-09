import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { kv } from '@vercel/kv';

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { prompt, sessionId } = await req.json();

    if (!prompt || !sessionId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    // 1. Configurar el modelo con instrucciones de sistema estrictas
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // Modelo rápido y económico
      systemInstruction: `
        Eres un experto en Roblox Luau. Tu tarea es generar scripts EJECUTABLES para Roblox Studio.
        REGLAS CRÍTICAS:
        1. NO uses bloques de código markdown (\`\`\`lua).
        2. NO incluyas explicaciones ni texto adicional. Solo código puro.
        3. Usa la API moderna de Roblox (ej: task.wait() en vez de wait()).
        4. Si el script debe ir en el workspace, asume que 'script.Parent' es el objeto a crear o modificar.
        5. Crea partes, instancias o lógica según pida el usuario.
      `
    });

    // 2. Generar el script
    const result = await model.generateContent(prompt);
    let luaCode = result.response.text();

    // 3. Limpieza de seguridad (Sanitización)
    // Aunque el prompt lo pide, a veces la IA falla. Limpiamos por si acaso.
    luaCode = luaCode.replace(/```lua/g, '').replace(/```/g, '').trim();

    // 4. Guardar en el "Buzón" (Redis)
    // Usamos la SessionID como clave. El script vive 60 segundos antes de expirar.
    // Esto evita que se ejecuten comandos viejos si el plugin se desconecta.
    await kv.set(`session:${sessionId}`, luaCode, { ex: 60 });

    return NextResponse.json({ success: true, message: "Script enviado al plugin" });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error generando script' }, { status: 500 });
  }
}
