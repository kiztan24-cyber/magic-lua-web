// src/app/api/chat/route.ts
import { kv } from '@vercel/kv';
import { KNOWLEDGE_BASE, getContextForQuery } from '@/lib/knowledge';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages, sessionId, action } = await req.json();
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey || !sessionId) return new Response('Error', { status: 400 });

    // 1. LEER ESTADO (RÁPIDO)
    const scriptsData = await kv.get(`scripts:${sessionId}`);
    const gameScripts = scriptsData ? JSON.parse(scriptsData as string) : [];

    // 2. PREPARAR STREAM
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
        };

        try {
          // A. ANÁLISIS INTELIGENTE (RAG)
          send('status', { message: '🔍 Analyzing request context...' });
          const lastMsg = messages[messages.length - 1].content;
          const context = getContextForQuery(lastMsg);
          
          // B. CONSTRUIR EL PROMPT MAESTRO
          const systemPrompt = `
ROLE: You are an Elite Roblox Engine Engineer.
Your goal is to generate PRODUCTION-READY Luau code.

CONTEXT - EXISTING ASSETS:
${context.assets.length > 0 ? `Use these Asset IDs if needed:\n${context.assets.map(a => `- ${a.name}: ${a.id}`).join('\n')}` : 'No specific assets found.'}

CONTEXT - BEST PRACTICES:
${KNOWLEDGE_BASE.rules.map(r => `- ${r}`).join('\n')}

CONTEXT - EXISTING GAME SCRIPTS:
${gameScripts.length > 0 ? gameScripts.map((s: any) => `- ${s.path}`).join('\n') : 'Project is empty.'}

AVAILABLE TOOLS (MagicAPI):
1. MagicAPI.CreateScript(name, source, parent) -> For Logic/Loops
2. MagicAPI.CreatePart(name, props, parent) -> For 3D Building
3. MagicAPI.CreateModuleScript(name, source, parent) -> For Reusable Code

CRITICAL OUTPUT RULES:
- OUTPUT ONLY PURE LUA CODE. NO MARKDOWN. NO COMMENTS.
- If the user asks for a sword, use the Asset ID provided above with 'InsertService'.
- If the user needs a loop, WRAP IT in a string and use CreateScript.
`;

          // C. LLAMADA A GEMINI (STREAMING)
          send('status', { message: '🧠 Engineering solution...' });
          
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: systemPrompt },
                  { text: `USER REQUEST: ${lastMsg}` }
                ]
              }]
            })
          });

          const data = await response.json();
          let rawCode = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

          // LIMPIEZA AGRESIVA DE CÓDIGO
          let cleanCode = rawCode
            .replace(/```lua/g, '')
            .replace(/```/g, '')
            .trim();

          // D. EJECUCIÓN
          if (action === 'execute') {
            send('status', { message: '⚡ Compiling for Roblox...' });
            await kv.set(`session:${sessionId}`, cleanCode, { ex: 300 });
            
            send('message', { 
              content: "**✅ Executed!**\nCheck Roblox Studio. The code is running.",
              type: 'execute' 
            });
          } else {
            send('message', { content: cleanCode, type: 'chat' });
          }

          send('done', {});
          controller.close();

        } catch (error: any) {
          send('error', { message: error.message });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server Error' }), { status: 500 });
  }
}
