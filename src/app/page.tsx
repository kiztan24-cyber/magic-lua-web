'use client';
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  type?: 'text' | 'plan' | 'success'; // Para estilos especiales
};

export default function ChatHome() {
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<string[]>([]); // Pasos de "pensamiento" simulados
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('magic_session_v2');
    if (stored) setSessionId(stored);
    else {
      const newId = uuidv4();
      setSessionId(newId);
      localStorage.setItem('magic_session_v2', newId);
    }
  }, []);

  // Auto-scroll al fondo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, steps]);

  // Simula pasos de "pensamiento" estilo Lemonade
  const simulateThinking = async () => {
    const fakeSteps = [
      "🔍 Analizando petición...",
      "📖 Consultando documentación de Roblox...",
      "🧠 Planificando arquitectura del script...",
      "✨ Generando respuesta..."
    ];
    
    for (const step of fakeSteps) {
      setSteps(prev => [...prev, step]);
      await new Promise(r => setTimeout(r, 800)); // Delay estético
    }
  };

  const handleSend = async (text: string, action: 'plan' | 'execute' = 'plan') => {
    if (!text.trim()) return;

    // Agregar mensaje del usuario
    const userMsg: Message = { id: uuidv4(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setSteps([]); // Limpiar pasos anteriores

    // Iniciar simulación visual de "pensamiento"
    simulateThinking();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ 
          messages: [...messages, userMsg], 
          sessionId,
          action 
        })
      });

      const data = await res.json();
      
      if (data.success) {
        setMessages(prev => [...prev, {
          id: uuidv4(),
          role: 'ai',
          content: data.reply,
          type: action === 'plan' ? 'plan' : 'success'
        }]);
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      setMessages(prev => [...prev, { id: uuidv4(), role: 'ai', content: "❌ Error de conexión." }]);
    } finally {
      setLoading(false);
      setSteps([]); // Ocultar pasos al terminar
    }
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-gray-200 font-sans">
      
      {/* SIDEBAR Minimalista */}
      <aside className="w-64 border-r border-white/10 flex flex-col p-4 bg-black/40">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
          <span className="font-bold text-lg text-white tracking-tight">MagicLua</span>
        </div>
        
        <div className="flex-1">
          <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Sesión Actual</div>
          <div className="mx-2 px-3 py-2 bg-white/5 rounded text-sm text-green-400 font-mono truncate border border-white/5">
            {sessionId}
          </div>
        </div>
      </aside>

      {/* CHAT AREA */}
      <main className="flex-1 flex flex-col relative max-w-4xl mx-auto w-full">
        
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
              <p className="text-2xl font-bold mb-2">¿Qué creamos hoy?</p>
              <p className="text-sm">Ej: "Sistema de stamina con barra de UI"</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] rounded-2xl p-5 ${
                  msg.role === 'user' 
                    ? 'bg-[#27272a] text-white' 
                    : 'bg-transparent border border-white/10'
                }`}
              >
                {/* Icono IA */}
                {msg.role === 'ai' && (
                  <div className="flex items-center gap-2 mb-3 text-yellow-500 text-sm font-bold uppercase tracking-wider">
                    <span className="text-lg">✨</span> MagicLua
                  </div>
                )}

                {/* Contenido Renderizado */}
                <div className="whitespace-pre-wrap leading-relaxed text-sm text-gray-300">
                  {msg.content}
                </div>

                {/* Botones de Acción (Solo para planes) */}
                {msg.type === 'plan' && (
                  <div className="mt-4 flex gap-2 pt-4 border-t border-white/10">
                    <button 
                      onClick={() => handleSend("No me gusta, cámbialo.", 'plan')}
                      className="px-4 py-2 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition"
                    >
                      Rechazar
                    </button>
                    <button 
                      onClick={() => handleSend("El plan es perfecto. Procede a codearlo.", 'execute')}
                      className="px-4 py-2 text-xs font-bold text-black bg-yellow-400 rounded-lg hover:bg-yellow-300 transition shadow-[0_0_15px_rgba(250,204,21,0.2)]"
                    >
                      Aprobar y Ejecutar ⚡
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Estado de Pensamiento (Thinking...) */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#18181b] border border-white/5 rounded-xl p-4 min-w-[300px]">
                <div className="flex items-center gap-2 mb-3 text-blue-400 text-xs font-bold uppercase animate-pulse">
                  <span>🧠</span> Pensando...
                </div>
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-500 animate-in slide-in-from-left-2 fade-in duration-300">
                      {i === steps.length - 1 ? <span className="animate-spin">⏳</span> : <span>✓</span>}
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 pt-0">
          <div className="relative">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend(input)}
              placeholder="Describe una mecánica o cambio..."
              className="w-full bg-[#18181b] border border-white/10 rounded-xl py-4 px-5 pr-12 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 transition-all shadow-xl"
              disabled={loading}
            />
            <button 
              onClick={() => handleSend(input)}
              disabled={loading || !input.trim()}
              className="absolute right-3 top-3 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
            >
              ➝
            </button>
          </div>
          <p className="text-center text-[10px] text-gray-700 mt-3">
            MagicLua v3.0 • Powered by Gemini Flash 2.5
          </p>
        </div>

      </main>
    </div>
  );
}
