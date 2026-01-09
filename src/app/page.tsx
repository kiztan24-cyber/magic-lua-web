// src/app/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { v4 as uuidv4 } from 'uuid';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'chat' | 'execute' | 'plan';
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState<string>(''); // Estado actual (ej: "Analizando...")
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generar o recuperar sesión
    let stored = localStorage.getItem('magic_session_v5');
    if (!stored) {
      stored = uuidv4();
      localStorage.setItem('magic_session_v5', stored);
    }
    setSessionId(stored);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMsg = input;
    setInput('');
    setIsGenerating(true);
    setStatus('Iniciando...');

    // 1. Agregar mensaje de usuario
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);

    // 2. Determinar acción (simple heurística)
    const action = userMsg.toLowerCase().startsWith('plan') ? 'plan' 
                 : (userMsg.toLowerCase().includes('crea') || userMsg.toLowerCase().includes('create')) ? 'execute' 
                 : 'chat';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages, 
          sessionId, 
          action 
        }),
      });

      if (!response.body) throw new Error("No response body");

      // 3. LEER STREAM (Server-Sent Events)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = '';

      // Crear mensaje vacío del asistente para ir llenándolo
      setMessages(prev => [...prev, { role: 'assistant', content: '', type: 'chat' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              
              if (json.type === 'status') {
                setStatus(json.data.message);
              } 
              else if (json.type === 'message') {
                assistantMsg = json.data.content;
                // Actualizar último mensaje
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { 
                    role: 'assistant', 
                    content: assistantMsg,
                    type: json.data.type
                  };
                  return updated;
                });
              }
              else if (json.type === 'error') {
                assistantMsg = "Error: " + json.data.message;
              }
            } catch (e) {
              // Ignorar chunks incompletos
            }
          }
        }
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'system', content: 'Error de conexión.' }]);
    } finally {
      setIsGenerating(false);
      setStatus('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0F0F0F] text-white font-sans">
      {/* HEADER */}
      <header className="flex items-center justify-between p-4 border-b border-[#2A2A2A] bg-[#141414]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
          <h1 className="text-lg font-bold tracking-tight">MAGICLUA <span className="text-xs font-normal text-gray-500 ml-2">PRO v5</span></h1>
        </div>
        <div className="text-xs text-gray-500 font-mono">ID: {sessionId.slice(0, 8)}...</div>
      </header>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-gray-800">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-4 ${
              msg.role === 'user' 
                ? 'bg-[#2563EB] text-white shadow-lg' 
                : 'bg-[#1E1E1E] border border-[#333] shadow-sm'
            }`}>
              {/* Icono de Asistente */}
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#333]">
                  <span className="text-xs font-bold text-yellow-500 uppercase">
                    {msg.type === 'execute' ? '⚡ Ejecutando en Roblox' : '🤖 Asistente'}
                  </span>
                </div>
              )}
              
              {/* Contenido Markdown */}
              <div className="prose prose-invert prose-sm max-w-none text-gray-200 leading-relaxed">
                <ReactMarkdown
                  components={{
                    code({node, inline, className, children, ...props}: any) {
                      return !inline ? (
                        <div className="bg-[#111] rounded-md p-3 my-2 border border-[#333] overflow-x-auto font-mono text-xs">
                          {children}
                        </div>
                      ) : (
                        <code className="bg-[#333] px-1 py-0.5 rounded text-yellow-200" {...props}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        
        {/* STATUS INDICATOR (Como Lemonade) */}
        {status && (
          <div className="flex justify-start">
            <div className="flex items-center gap-3 bg-[#1A1A1A] border border-[#333] rounded-full px-4 py-2 animate-pulse">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
              <span className="text-xs text-green-400 font-mono">{status}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-[#141414] border-t border-[#2A2A2A]">
        <form onSubmit={sendMessage} className="relative max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe qué quieres crear en Roblox..."
            className="w-full bg-[#1F1F1F] border border-[#333] text-white rounded-xl py-4 pl-5 pr-12 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all shadow-xl placeholder-gray-500"
            disabled={isGenerating}
          />
          <button 
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="absolute right-3 top-3 p-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </form>
        <div className="text-center mt-2 text-[10px] text-gray-600">
          Potenciado por Gemini 2.5 • RAG Activado • MagicLua v5
        </div>
      </div>
    </div>
  );
}
