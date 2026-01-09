import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic'; 

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) return NextResponse.json({ hasCommand: false });

    const script = await kv.get(`session:${sessionId}`);

    if (script) {
      await kv.del(`session:${sessionId}`);
      return NextResponse.json({ hasCommand: true, script });
    }

    return NextResponse.json({ hasCommand: false });
  } catch (error) {
    return NextResponse.json({ hasCommand: false });
  }
}
