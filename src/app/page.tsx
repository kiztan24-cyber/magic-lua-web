'use client';
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Tipos para los estados de la IA
type AIState = 'idle' | 'planning' | 'waiting_approval' | 'generating' | 'done' | 'error';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [aiState, setAiState] = useState<AIState>('idle');
  const [plan, setPlan] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  
  // Efecto para inicializar sesión
  useEffect(() => {
    const stored = localStorage.getItem('magic_session');
    if (stored) setSessionId(stored);
    else {
      const newId = uuidv4();
      setSessionId(newId);
      localStorage.setItem('magic_session', newId);
    }
  }, []);

  // Función para agregar logs simulados
  const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`]);

  // PASO 1: Planificar
  const handlePlan = async () => {
    if (!prompt) return;
    setAiState('planning');
    setLogs(['> Analizando petición...', '> Consultando documentación de Roblox API...']);
    
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      
      if (data.success) {
        setPlan(data.plan);
        setAiState('waiting_approval');
        addLog('> Plan generado. Esperando aprobación del usuario.');
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      setAiState('error');
      addLog('Error al planificar.');
    }
  };

  // PASO 2: Ejecutar (Generar Código)
  const handleExecute = async () => {
    setAiState('generating');
    addLog('> Plan aprobado. Generando script Lua optimizado...');
    addLog('> Escribiendo lógica de servidor...');
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt, plan, sessionId })
      });
      
      if (res.ok) {
        setAiState('done');
        addLog('> ¡Script enviado a Roblox Studio!');
        addLog('> Listo para sincronizar.');
      } else {
        throw new Error('Error en generación');
      }
    } catch (e) {
      setAiState('error');
      addLog('Error generando código.');
    }
  };

  const handleCancel = () => {
    setAiState('idle');
    setPlan('');
    setLogs([]);
    setPrompt('');
  };

  return (
    <div className="flex h-screen bg-[#111] text-gray-200 font-sans overflow-hidden">
      
      {/* SIDEBAR (Estilo Lemonade) */}
      <aside className="w-64 border-r border-gray-800 flex flex-col p-4 bg-[#0a0a0a]">
        <div className="mb-8 flex items-center gap-2">
          <div className="w-6 h-6 bg-yellow-400 rounded-full blur-[2px]"></div>
          <span className="font-bold text-xl tracking-tight text-white">MagicLua</span>
        </div>
        
        <nav className="space-y-1 flex-1">
          <button className="w-full text-left px-3 py-2 rounded-md bg-gray-800 text-white font-medium text-sm">
            + Nuevo Proyecto
          </button>
          
          <div className="mt-6">
            <p className="text-xs font-bold text-gray-500 uppercase px-3 mb-2">Proyectos</p>
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-sm text-blue-400 cursor-pointer bg-blue-400/10 rounded">
                🚀 {sessionId.slice(0, 8)}...
              </div>
            </div>
          </div>
        </nav>

        <div className="mt-auto pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">v3.0.0 Beta</p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative">
        
        {/* Header */}
        <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6">
          <h2 className="text-sm font-medium text-gray-400">Workspace / Generador</h2>
          <div className="flex gap-2">
            <span className={`w-2 h-2 rounded-full ${aiState === 'done' ? 'bg-green-500' : 'bg-gray-600'}`}></span>
            <span className="text-xs text-gray-500">Status: {aiState.toUpperCase()}</span>
          </div>
        </header>

        {/* Central Area */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center">
          
          {aiState === 'idle' && (
            <div className="w-full max-w-2xl text-center space-y-6">
              <h1 className="text-4xl font-bold text-white mb-2">Describe una mecánica de juego...</h1>
              <div className="relative group">
                <input 
                  type="text" 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ej: Haz que lluevan meteoritos cuando toco una parte..."
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-full py-4 px-6 text-lg text-white focus:outline-none focus:border-yellow-500 transition-all shadow-xl"
                  onKeyDown={(e) => e.key === 'Enter' && handlePlan()}
                />
                <button 
                  onClick={handlePlan}
                  className="absolute right-2 top-2 bg-gray-700 hover:bg-gray-600 p-2 rounded-full transition-colors"
                >
                  ➝
                </button>
              </div>
            </div>
          )}

          {(aiState !== 'idle') && (
            <div className="w-full max-w-2xl space-y-6">
              {/* Card de Estado */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-2xl">
                
                {/* Logs / Terminal */}
                <div className="mb-4 font-mono text-xs text-gray-500 space-y-1 h-32 overflow-y-auto bg-black/30 p-4 rounded-lg">
                  {logs.map((log, i) => (
                    <div key={i} className="animate-pulse">{log}</div>
                  ))}
                  {aiState === 'planning' && <div className="text-yellow-500">Thinking...</div>}
                  {aiState === 'generating' && <div className="text-blue-500">Coding...</div>}
                </div>

                {/* Plan View */}
                {plan && (
                  <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-yellow-400 font-bold mb-2 text-sm uppercase tracking-wide">Plan Propuesto</h3>
                    <div className="bg-[#111] p-4 rounded-lg text-gray-300 text-sm whitespace-pre-wrap border border-gray-700">
                      {plan}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {aiState === 'waiting_approval' && (
                  <div className="flex gap-4 mt-6">
                    <button 
                      onClick={handleCancel}
                      className="flex-1 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition font-medium"
                    >
                      Rechazar / Cancelar
                    </button>
                    <button 
                      onClick={handleExecute}
                      className="flex-1 py-3 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-300 transition shadow-lg shadow-yellow-400/20"
                    >
                      Aprobar y Generar Código ⚡
                    </button>
                  </div>
                )}

                {aiState === 'done' && (
                  <div className="text-center mt-4">
                    <p className="text-green-400 font-bold mb-4">¡Código listo en el servidor!</p>
                    <button 
                      onClick={handleCancel}
                      className="text-gray-500 hover:text-white underline text-sm"
                    >
                      Crear nueva magia
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
