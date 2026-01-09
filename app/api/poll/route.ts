import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) return NextResponse.json({ error: 'No Session ID' }, { status: 400 });

  // 1. Buscar si hay un comando pendiente para esta sesión
  const script = await kv.get(`session:${sessionId}`);

  if (script) {
    // 2. Si existe, lo devolvemos y LO BORRAMOS inmediatamente.
    // Esto asegura que el código solo se ejecute UNA VEZ en el juego.
    await kv.del(`session:${sessionId}`);
    
    return NextResponse.json({ 
      hasCommand: true, 
      script: script 
    });
  }

  // 3. Si no hay nada, responder vacío para no saturar
  return NextResponse.json({ hasCommand: false });
}
