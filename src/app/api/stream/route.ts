import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, sessionId, action } = body;

    if (!messages || !sessionId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Helper seguro para enviar eventos SSE
        const sendEvent = (type: string, data: any) => {
          try {
            const payload = JSON.stringify({ type, data });
            const message = `data: ${payload}\n\n`;
            controller.enqueue(encoder.encode(message));
          } catch (err) {
            console.error('SSE Encode Error:', err);
          }
        };

        try {
          // Paso 1: Leer estado del juego
          sendEvent('status', { message: '🔍 Reading game state...' });
          await new Promise(r => setTimeout(r, 500));

          const scriptsData = await kv.get(`scripts:${sessionId}`);
          const gameScripts = scriptsData ? JSON.parse(scriptsData as string) : [];

          sendEvent('status', { message: '📚 Analyzing Roblox API...' });
          await new Promise(r => setTimeout(r, 700));

          sendEvent('status', { message: '🧠 Generating solution...' });

          // Preparar contexto para la IA
          const lastMsg = messages[messages.length - 1]?.content || '';
          
          const systemPrompt = action === 'plan' ? `
You are a Senior Roblox Architect.

TASK: Create a concise technical implementation plan.

FORMAT (Markdown):
### Implementation Plan
- [ ] Step 1 (specific, technical)
- [ ] Step 2
- [ ] Step 3

RULES:
- Maximum 8 steps
- No introductions or long explanations
`.trim() : `
You are an Expert Roblox Scripter.

CONVERSATION HISTORY:
${messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}

CURRENT GAME STATE:
${gameScripts.length > 0 ? `Scripts in game:\n${gameScripts.map((s: any) => `- ${s.path}`).join('\n')}` : 'No scripts yet'}

AVAILABLE TOOLS (MagicAPI):
You have these functions available:

**Script Management:**
- MagicAPI.CreateScript(name, source, parentPath) - Create a Script
- MagicAPI.CreateLocalScript(name, source, parentPath) - Create LocalScript
- MagicAPI.CreateModuleScript(name, source, parentPath) - Create ModuleScript
- MagicAPI.ReadScript(path) - Read existing script
- MagicAPI.EditScript(path, oldCode, newCode) - Edit script
- MagicAPI.DeleteScript(path) - Delete script

**Workspace:**
- MagicAPI.CreatePart(name, properties, parentPath) - Create Part
- MagicAPI.CreateFolder(name, parentPath) - Create Folder
- MagicAPI.DeleteObject(path) - Delete object

CRITICAL RULES:
1. Your code runs via loadstring. There is NO "script" variable.
2. NEVER use script.Parent
3. For persistent logic (loops, events), use MagicAPI.CreateScript to make a real Script file
4. Example for day/night cycle:
   \`\`\`lua
   local cycleCode = [[
   local Lighting = game:GetService("Lighting")
   while task.wait(0.1) do
       Lighting.ClockTime = (Lighting.ClockTime + 0.01) % 24
   end
   ]]
   MagicAPI.CreateScript("DayNightCycle", cycleCode, "ServerScriptService")
   \`\`\`

OUTPUT:
- Pure Lua code only
- No markdown blocks
- Use MagicAPI functions
`.trim();

          // Llamar a Gemini
          const modelName = 'gemini-2.5-flash';
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

          const geminiResp = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: systemPrompt },
                  { text: `\n\nUser Request:\n${lastMsg}` }
                ]
              }]
            })
          });

          if (!geminiResp.ok) {
            const errText = await geminiResp.text();
            throw new Error(`Gemini error: ${geminiResp.status} - ${errText}`);
          }

          const geminiData = await geminiResp.json();
          let reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI';

          // Si es ejecución, guardar en Redis
          if (action === 'execute') {
            sendEvent('status', { message: '📦 Packaging code...' });
            
            const cleanCode = reply
              .replace(/```lua\s*/gi, '')
              .replace(/```\s*/g, '')
              .trim();

            await kv.set(`session:${sessionId}`, cleanCode, { ex: 300 });
            
            sendEvent('status', { message: '✅ Code sent to Roblox Studio' });
            reply = '**✅ Code Generated**\n\nThe script has been sent to your plugin. Check Roblox Studio!';
          }

          // Enviar respuesta final
          sendEvent('message', { content: reply, type: action });
          sendEvent('done', {});
          
          controller.close();

        } catch (error: any) {
          console.error('Stream Error:', error);
          sendEvent('error', { message: error.message || 'Unknown error' });
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

  } catch (error: any) {
    console.error('SSE Setup Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
