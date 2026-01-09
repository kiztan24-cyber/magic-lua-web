import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'No sessionId' }, { status: 400 });
    }

    const body = await req.json();
    const { scripts } = body;

    // Guardar lista de scripts en Redis (expira en 10 min)
    await kv.set(`scripts:${sessionId}`, JSON.stringify(scripts), { ex: 600 });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
