'use client';
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown'; // Necesitarás instalar esto: npm install react-markdown

// Tipos
type Message = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  type?: 'text' | 'plan' | 'success';
  steps?: string[]; // Pasos reales de la IA
};

export default function ChatHome() {
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Inicialización Session ID
  useEffect(() => {
    const stored = localStorage.getItem('magic_session_v3');
    if (stored) setSessionId(stored);
    else {
      const newId = uuidv4();
      setSessionId(newId);
      localStorage.setItem('magic_session_v3', newId);
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStep]);

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    alert("Session ID copiada al portapapeles 📋");
  };

  const handleSend = async (text: string, action: 'plan' | 'execute' = 'plan') => {
    if (!text.trim()) return;

    const userMsg: Message = { id: uuidv4(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Simulación de pasos de pensamiento (Visual)
    const thinkingSteps = [
      "🔍 Analizando contexto...",
      "📚 Revisando documentación de Roblox...",
      "🧠 Diseñando arquitectura...",
      "📝 Redactando respuesta..."
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < thinkingSteps.length) {
        setCurrentStep(thinkingSteps[stepIndex]);
        stepIndex++;
      }
    }, 1500);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMsg], 
          sessionId,
          action 
        })
      });

      const data = await res.json();
      clearInterval(interval);
      setCurrentStep(''); // Limpiar paso actual

      if (data.success) {
        setMessages(prev => [...prev, {
          id: uuidv4(),
          role: 'ai',
          content: data.reply,
          type: action === 'plan' ? 'plan' : 'success',
          steps: data.steps // Pasos reales devueltos por la API si los hubiera
        }]);
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      clearInterval(interval);
      setCurrentStep('');
      setMessages(prev => [...prev, { id: uuidv4(), role: 'ai', content: "❌ Error de conexión con el cerebro." }]);
    } finally {
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
          
          <div className="space-y-4">
            <div className="bg-[#18181b] border border-white/5 rounded-xl p-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">Sesión Activa</p>
              <div 
                onClick={copySessionId}
                className="group flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors"
              >
                <code className="text-xs text-green-400 font-mono truncate flex-1 opacity-80 group-hover:opacity-100">
                  {sessionId}
                </code>
                <span className="text-gray-500 hover:text-white text-xs">📋</span>
              </div>
            </div>
            
            <button 
              onClick={() => {
                setMessages([]);
                localStorage.removeItem('magic_session_v3');
                window.location.reload();
              }}
              className="w-full py-2 px-4 text-xs font-medium text-gray-400 border border-white/5 rounded-lg hover:bg-white/5 hover:text-white transition"
            >
              + Nueva Conversación
            </button>
          </div>
        </div>
      </aside>

      {/* CHAT AREA */}
      <main className="flex-1 flex flex-col relative bg-gradient-to-b from-[#09090b] to-[#0c0c0e]">
        
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 bg-[#18181b] rounded-2xl flex items-center justify-center mb-4 border border-white/5">
                <span className="text-3xl">✨</span>
              </div>
              <h2 className="text-2xl font-bold text-white">¿Qué vamos a construir hoy?</h2>
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {["Sistema de inventario", "NPC que te sigue", "Tienda de armas", "Ciclo día/noche"].map((suggestion) => (
                  <button 
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="p-3 bg-[#18181b] border border-white/5 rounded-xl text-sm text-gray-400 hover:border-yellow-500/30 hover:text-yellow-400 transition text-left"
                  >
                    {suggestion} →
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
              <div 
                className={`max-w-2xl rounded-2xl p-6 ${
                  msg.role === 'user' 
                    ? 'bg-[#27272a] text-white shadow-lg' 
                    : 'bg-transparent pl-0'
                }`}
              >
                {msg.role === 'ai' && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 bg-gradient-to-br from-yellow-400 to-orange-500 rounded flex items-center justify-center text-[10px] text-black font-bold">AI</div>
                    <span className="text-sm font-bold text-gray-300">MagicLua</span>
                  </div>
                )}

                {/* Contenido con Markdown Renderizado */}
                <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {/* Botones de Acción para Planes */}
                {msg.type === 'plan' && (
                  <div className="mt-6 flex gap-3 pt-4 border-t border-white/5">
                    <button 
                      onClick={() => handleSend("No me convence, simplifícalo.", 'plan')}
                      className="px-4 py-2 text-xs font-medium text-gray-400 bg-white/5 rounded-lg hover:bg-white/10 hover:text-white transition"
                    >
                      Refinar Plan
                    </button>
                    <button 
                      onClick={() => handleSend("El plan es correcto. Genera el código.", 'execute')}
                      className="px-5 py-2 text-xs font-bold text-black bg-yellow-400 rounded-lg hover:bg-yellow-300 transition shadow-[0_0_20px_rgba(250,204,21,0.15)] flex items-center gap-2"
                    >
                      <span>🚀</span> Aprobar y Generar
                    </button>
                  </div>
                )}
                
                {msg.type === 'success' && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-400 font-medium">Código enviado a Roblox Studio</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Estado de Pensamiento Activo */}
          {loading && (
            <div className="flex justify-start pl-0 animate-pulse">
              <div className="flex items-center gap-3 text-sm text-gray-500 bg-[#18181b] py-2 px-4 rounded-full border border-white/5">
                <span className="animate-spin">⏳</span>
                <span className="font-mono text-xs">{currentStep || "Procesando..."}</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 mx-auto w-full max-w-4xl">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative flex items-center bg-[#18181b] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend(input)}
                placeholder="Describe tu mecánica o cambio..."
                className="flex-1 bg-transparent py-4 px-6 text-white placeholder-gray-600 focus:outline-none"
                disabled={loading}
              />
              <button 
                onClick={() => handleSend(input)}
                disabled={loading || !input.trim()}
                className="p-3 mr-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-30"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-gray-600 mt-4 font-mono">
            MagicLua v3.5 • Powered by Gemini 2.5 Flash
          </p>
        </div>

      </main>
    </div>
  );
}
