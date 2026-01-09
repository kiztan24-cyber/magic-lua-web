import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages, sessionId, action } = await req.json();
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY!;

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
      };

      try {
        send('status', { message: '🔍 Reading game state...' });
        await new Promise(r => setTimeout(r, 600));

        // Obtener lista de scripts actual
        const scriptsData = await kv.get(`scripts:${sessionId}`);
        const gameScripts = scriptsData ? JSON.parse(scriptsData as string) : [];

        send('status', { message: '📚 Analyzing Roblox documentation...' });
        await new Promise(r => setTimeout(r, 800));

        send('status', { message: '🧠 Generating solution...' });

        const modelName = 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        // CONTEXTO COMPLETO PARA LA IA
        const systemContext = action === 'plan' ? `
You are a Senior Roblox Architect.

OBJECTIVE: Create a technical implementation checklist.

FORMAT (Markdown):
### Implementation Plan
- [ ] Step 1 (specific and technical)
- [ ] Step 2
- [ ] Step 3

RULES:
- Maximum 8 steps
- No introductions or conclusions
- Be extremely concise
`.trim() : `
You are an Expert Roblox Scripter.

CONVERSATION CONTEXT:
${messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}

CURRENT GAME STATE (Scripts in ServerScriptService):
${gameScripts.length > 0 ? gameScripts.map((s: any) => `- ${s.path} (${s.type})`).join('\n') : 'No scripts yet'}

AVAILABLE TOOLS (MagicAPI):
You have access to these functions in your code:

1. **Script Management:**
   - \`MagicAPI.ListAllScripts()\` - Get all scripts
   - \`MagicAPI.ReadScript(path)\` - Read script source code
   - \`MagicAPI.CreateScript(name, source, parentPath)\` - Create Script
   - \`MagicAPI.CreateLocalScript(name, source, parentPath)\` - Create LocalScript
   - \`MagicAPI.CreateModuleScript(name, source, parentPath)\` - Create ModuleScript
   - \`MagicAPI.EditScript(path, oldCode, newCode)\` - Edit existing script
   - \`MagicAPI.DeleteScript(path)\` - Delete script

2. **Workspace Management:**
   - \`MagicAPI.CreatePart(name, properties, parentPath)\` - Create Part with properties
   - \`MagicAPI.CreateFolder(name, parentPath)\` - Create Folder
   - \`MagicAPI.DeleteObject(path)\` - Delete object
   - \`MagicAPI.FindObject(name)\` - Find object in workspace

CRITICAL EXECUTION RULES:
- Your code runs with \`loadstring\`. There is NO \`script\` variable.
- **NEVER** use \`script.Parent\`.
- For complex logic (loops, events), use \`MagicAPI.CreateScript\` to create a real Script file.
- If you need to modify existing code, first read it with \`MagicAPI.ReadScript\`, then edit with \`MagicAPI.EditScript\`.

YOUR TASK:
Generate Lua code that uses MagicAPI tools to fulfill the user's request based on the approved plan.

OUTPUT FORMAT:
- Pure Lua code only
- No markdown, no explanations
- Use MagicAPI functions for all operations
`.trim();

        const lastMsg = messages[messages.length - 1]?.content || '';

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: systemContext },
                { text: `\n\nUser Request:\n${lastMsg}` }
              ]
            }]
          })
        });

        if (!resp.ok) throw new Error(`Gemini: ${resp.status}`);

        const data = await resp.json();
        let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

        if (action === 'execute') {
          send('status', { message: '📦 Packaging code...' });
          const clean = reply.replace(/```lua\s*/gi, '').replace(/```/g, '').trim();
          await kv.set(`session:${sessionId}`, clean, { ex: 300 });
          
          send('status', { message: '✅ Code sent to Roblox Studio' });
          reply = '**✅ Code Generated**\n\nCheck your game. The magic should happen shortly.';
        }

        send('message', { content: reply, type: action });
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
    }
  });
}
