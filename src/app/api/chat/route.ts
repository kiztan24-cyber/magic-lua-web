import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, sessionId, action } = body;

    if (!messages || !sessionId || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 500 });
    }

    // Obtener scripts del juego
    const scriptsData = await kv.get(`scripts:${sessionId}`);
    const gameScripts = scriptsData ? JSON.parse(scriptsData as string) : [];

    // Preparar prompt
    const lastMsg = messages[messages.length - 1]?.content || '';
    
    let systemPrompt = '';
    
    if (action === 'plan') {
      systemPrompt = `You are a Roblox Architect. Create a brief technical plan (max 6 steps) in Markdown checklist format. No long explanations.`;
    } else {
      systemPrompt = `You are a Roblox Expert Scripter.

CONVERSATION:
${messages.slice(-3).map((m: any) => `${m.role}: ${m.content}`).join('\n')}

GAME STATE:
${gameScripts.length > 0 ? `Scripts: ${gameScripts.map((s: any) => s.path).join(', ')}` : 'No scripts yet'}

TOOLS AVAILABLE (MagicAPI):
- MagicAPI.CreateScript(name, source, parent) - Create a Script
- MagicAPI.CreateLocalScript(name, source, parent) - Create LocalScript
- MagicAPI.CreatePart(name, props, parent) - Create Part
- MagicAPI.CreateFolder(name, parent) - Create Folder

CRITICAL RULES:
1. Code runs via loadstring. NO "script" variable exists.
2. For loops/events, create a Script file with MagicAPI.CreateScript
3. Example for day/night cycle:

local code = [[
local Lighting = game:GetService("Lighting")
while task.wait(0.1) do
    Lighting.ClockTime = (Lighting.ClockTime + 0.01) % 24
end
]]
MagicAPI.CreateScript("DayNightCycle", code, "ServerScriptService")

OUTPUT: Pure Lua code. No markdown blocks.`;
    }

    // Llamar Gemini
    const modelName = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            { text: `\nUser: ${lastMsg}` }
          ]
        }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini: ${resp.status} - ${errText}`);
    }

    const data = await resp.json();
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

    // Si es execute, guardar en Redis
    if (action === 'execute') {
      const clean = reply.replace(/```lua\s*/gi, '').replace(/```/g, '').trim();
      await kv.set(`session:${sessionId}`, clean, { ex: 300 });
      reply = '**✅ Code Generated**\n\nScript sent to Roblox Studio. Check your game!';
    }

    return NextResponse.json({ success: true, reply, type: action });

  } catch (error: any) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
