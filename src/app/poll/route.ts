import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic'; // Vital para evitar caché estático

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) return NextResponse.json({ error: 'No Session ID' }, { status: 400 });

  // Buscar script pendiente en Redis
  const script = await kv.get(`session:${sessionId}`);

  if (script) {
    // Si hay script, lo enviamos y lo borramos de la cola
    await kv.del(`session:${sessionId}`);
    
    return NextResponse.json({ 
      hasCommand: true, 
      script: script 
    });
  }

  return NextResponse.json({ hasCommand: false });
}
