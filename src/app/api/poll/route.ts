import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic'; // <--- ESTO ES VITAL

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const script = await kv.get(`session:${sessionId}`);

    if (script) {
      await kv.del(`session:${sessionId}`); // Borrar tras leer (consumir)
      return NextResponse.json({ 
        hasCommand: true, 
        script: script 
      });
    }

    return NextResponse.json({ hasCommand: false });
  } catch (error) {
    console.error("Poll Error:", error);
    return NextResponse.json({ hasCommand: false }, { status: 500 });
  }
}
