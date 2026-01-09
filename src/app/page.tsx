'use client';
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  type?: 'text' | 'plan' | 'success';
};

export default function ChatHome() {
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('magic_session_v4');
    if (stored) setSessionId(stored);
    else {
      const newId = uuidv4();
      setSessionId(newId);
      localStorage.setItem('magic_session_v4', newId);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStep]);

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    // Podrías usar un toast notification aquí si quisieras
  };

  const handleSend = async (text: string, action: 'plan' | 'execute' = 'plan') => {
  if (!text.trim()) return;

  const userMsg: Message = { id: uuidv4(), role: 'user', content: text };
  setMessages(prev => [...prev, userMsg]);
  setInput('');
  setLoading(true);
  setCurrentStep('Conectando...');

  try {
    const response = await fetch('/api/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...messages, userMsg], sessionId, action })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = JSON.parse(line.slice(6));

        if (json.type === 'status') {
          setCurrentStep(json.data.message); // ✨ Actualización REAL
        } else if (json.type === 'message') {
          setMessages(prev => [...prev, {
            id: uuidv4(),
            role: 'ai',
            content: json.data.content,
            type: json.data.type === 'plan' ? 'plan' : 'success'
          }]);
        } else if (json.type === 'done') {
          setLoading(false);
          setCurrentStep('');
        }
      }
    }
  } catch (e) {
    setMessages(prev => [...prev, { id: uuidv4(), role: 'ai', content: '❌ Error de conexión' }]);
    setLoading(false);
  }
};


  return (
    <div className="flex h-screen bg-[#09090b] text-gray-200 font-sans selection:bg-yellow-500/30">
      
      {/* SIDEBAR */}
      <aside className="w-72 border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-yellow-400 rounded-lg shadow-[0_0_15px_rgba(250,204,21,0.3)] flex items-center justify-center">
              <span className="text-black font-bold text-lg">M</span>
            </div>
            <span className="font-bold text-xl text-white tracking-tight">MagicLua</span>
          </div>
          
          <div className="bg-[#18181b] border border-white/5 rounded-xl p-4 mb-4">
            <p className="text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">Sesión Activa</p>
            <div onClick={copySessionId} className="group flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors">
              <code className="text-xs text-green-400 font-mono truncate flex-1 opacity-80 group-hover:opacity-100">{sessionId}</code>
              <span className="text-gray-500 hover:text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">📋</span>
            </div>
          </div>
          
          <button onClick={() => { localStorage.removeItem('magic_session_v4'); window.location.reload(); }} className="w-full py-2 px-4 text-xs font-medium text-gray-400 border border-white/5 rounded-lg hover:bg-white/5 hover:text-white transition">
            + Nueva Conversación
          </button>
        </div>
        <div className="mt-auto p-6 text-xs text-gray-600">v3.0.0 Stable</div>
      </aside>

      {/* CHAT AREA */}
      <main className="flex-1 flex flex-col relative bg-gradient-to-b from-[#09090b] to-[#0c0c0e]">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 bg-[#18181b] rounded-2xl flex items-center justify-center mb-4 border border-white/5"><span className="text-3xl">✨</span></div>
              <h2 className="text-2xl font-bold text-white">¿Qué vamos a construir hoy?</h2>
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {["Sistema de inventario", "NPC que te sigue", "Tienda de armas", "Ciclo día/noche"].map((s) => (
                  <button key={s} onClick={() => handleSend(s)} className="p-3 bg-[#18181b] border border-white/5 rounded-xl text-sm text-gray-400 hover:border-yellow-500/30 hover:text-yellow-400 transition text-left">{s} →</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
              <div className={`max-w-2xl rounded-2xl p-6 ${msg.role === 'user' ? 'bg-[#27272a] text-white shadow-lg' : 'bg-transparent pl-0'}`}>
                {msg.role === 'ai' && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 bg-gradient-to-br from-yellow-400 to-orange-500 rounded flex items-center justify-center text-[10px] text-black font-bold">AI</div>
                    <span className="text-sm font-bold text-gray-300">MagicLua</span>
                  </div>
                )}
                
                <div className="prose prose-invert prose-sm max-w-none text-gray-300"><ReactMarkdown>{msg.content}</ReactMarkdown></div>

                {msg.type === 'plan' && (
                  <div className="mt-6 flex gap-3 pt-4 border-t border-white/5">
                    <button onClick={() => handleSend("No me convence, hazlo diferente.", 'plan')} className="px-4 py-2 text-xs font-medium text-gray-400 bg-white/5 rounded-lg hover:bg-white/10 hover:text-white transition">Refinar</button>
                    <button onClick={() => handleSend("El plan es correcto. Genera el código.", 'execute')} className="px-5 py-2 text-xs font-bold text-black bg-yellow-400 rounded-lg hover:bg-yellow-300 transition shadow-[0_0_20px_rgba(250,204,21,0.15)] flex items-center gap-2"><span>🚀</span> Aprobar y Generar</button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
  <div className="flex justify-start pl-0">
    <div className="flex items-center gap-3 text-sm bg-[#18181b] py-3 px-5 rounded-2xl border border-white/5 shadow-xl">
      <div className="relative">
        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping absolute"></div>
        <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
      </div>
      <span className="font-mono text-xs text-gray-400 animate-pulse">{currentStep}</span>
    </div>
  </div>
)}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 mx-auto w-full max-w-4xl">
          <div className="relative flex items-center bg-[#18181b] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend(input)} placeholder="Describe tu mecánica o cambio..." className="flex-1 bg-transparent py-4 px-6 text-white placeholder-gray-600 focus:outline-none" disabled={loading} />
            <button onClick={() => handleSend(input)} disabled={loading || !input.trim()} className="p-3 mr-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-30">➝</button>
          </div>
        </div>
      </main>
    </div>
  );
}
