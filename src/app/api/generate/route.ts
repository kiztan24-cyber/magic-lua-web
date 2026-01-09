import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    // modelo válido en la API v1, recomendado para código
    model: "gemini-1.5-flash-8b", 
    systemInstruction: `
    Eres un experto en Roblox Luau. Solo devuelves código ejecutable, sin markdown, sin explicaciones.
     `,
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
