import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';
export const runtime = 'edge'; // Necesario para streaming

export async function POST(req: Request) {
  const { messages, sessionId, action } = await req.json();
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY!;

  const encoder = new TextEncoder();
  
  // Crear stream SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Helper para enviar eventos
      const sendEvent = (type: string, data: any) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
        );
      };

      try {
        // Paso 1: Notificar inicio
        sendEvent('status', { message: '🔍 Analizando petición...' });
        await new Promise(r => setTimeout(r, 800));

        sendEvent('status', { message: '📚 Consultando docs de Roblox...' });
        await new Promise(r => setTimeout(r, 1000));

        // Paso 2: Llamar a Gemini
        sendEvent('status', { message: '🧠 Generando respuesta...' });
        
        const modelName = 'gemini-2.5-flash';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        const systemPrompt = action === 'plan' 
          ? 'Genera un checklist técnico...' 
          : 'Genera código Lua usando MagicAPI...';

        const resp = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt + '\n\n' + messages[messages.length - 1].content }] }]
          })
        });

        const data = await resp.json();
        let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Paso 3: Enviar respuesta completa
        if (action === 'execute') {
          sendEvent('status', { message: '📦 Empaquetando código...' });
          const clean = reply.replace(/```lua\s*/gi, '').replace(/```/g, '').trim();
          await kv.set(`session:${sessionId}`, clean, { ex: 300 });
          
          sendEvent('status', { message: '✅ Código enviado a Roblox Studio' });
          reply = '**✅ Código Generado**\n\nRevisa tu juego.';
        }

        sendEvent('message', { content: reply, type: action });
        sendEvent('done', {});
        controller.close();

      } catch (error: any) {
        sendEvent('error', { message: error.message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  });
}
