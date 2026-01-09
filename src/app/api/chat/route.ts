import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, sessionId, action } = await req.json(); // 'action' puede ser 'plan' o 'execute'

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    // Usamos el modelo que ya sabemos que funciona
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    let systemPrompt = "";
    let userPrompt = messages[messages.length - 1].content;

    if (action === 'plan') {
      systemPrompt = `Eres un Ingeniero Senior de Roblox.
      TU OBJETIVO: Crear un Checklist Técnico de Implementación.
      
      REGLAS DE FORMATO:
      1. NO uses párrafos largos ni introducciones ("Hola, claro que sí...").
      2. Usa Markdown checkboxes para cada paso: "- [ ] Paso".
      3. Sé extremadamente conciso y técnico.
      
      Ejemplo de salida deseada:
      ### Summary Checklist
      - [ ] Crear Script en ServerScriptService
      - [ ] Definir RemoteEvent 'OnFire'
      - [ ] Implementar lógica de debounce (0.5s)
      - [ ] Conectar evento de daño al Humanoid

      Escenario detectado: New Mechanic / Refactor
      Herramienta sugerida: CreateScript`;
    } 
    else if (action === 'execute') {
      // Recuperamos el plan del historial de mensajes
      const planContext = messages.map((m:any) => `${m.role}: ${m.content}`).join('\n');
      
      systemPrompt = `Eres un Experto Scripter de Roblox.
      CONTEXTO:
      ${planContext}
      
      TAREA: Genera el script Lua FINAL basado en el plan aprobado.
      REGLAS:
      - SOLO código Lua puro.
      - Sin markdown (\`\`\`).
      - Código robusto y profesional.`;
    }

    // Llamada a Gemini
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt}\n\nUsuario: ${userPrompt}` }]
        }]
      })
    });

    if (!response.ok) throw new Error(await response.text());

    const data = await response.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error generando respuesta.";

    // Si es ejecución, guardamos en Redis para el plugin
    if (action === 'execute') {
      // Limpiar código para Redis
      const cleanCode = reply.replace(/```lua\n?/g, '').replace(/```\n?/g, '').trim();
      await kv.set(`session:${sessionId}`, cleanCode, { ex: 300 }); // 5 min
      
      reply = "✅ **Código generado y enviado a Roblox Studio.**\nRevisa tu juego, la magia debería ocurrir en breve.";
    }

    return NextResponse.json({ success: true, reply });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
