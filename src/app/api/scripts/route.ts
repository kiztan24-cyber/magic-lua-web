import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ scripts: [] });
    }

    const scriptsData = await kv.get(`scripts:${sessionId}`);
    const scripts = scriptsData ? JSON.parse(scriptsData as string) : [];

    return NextResponse.json({ scripts });
  } catch (error) {
    return NextResponse.json({ scripts: [] });
  }
}
