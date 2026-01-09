'use client';
import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Listo');

  // Generar Session ID al cargar la página
  useEffect(() => {
    // Intentar recuperar una sesión previa o crear una nueva
    const storedSession = localStorage.getItem('magic_session_id');
    if (storedSession) {
      setSessionId(storedSession);
    } else {
      const newSession = uuidv4();
      setSessionId(newSession);
      localStorage.setItem('magic_session_id', newSession);
    }
  }, []);

  const handleSend = async () => {
    if (!prompt) return;
    setLoading(true);
    setStatus('Generando magia con Gemini...');

    const res = await fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, sessionId }),
    });

    if (res.ok) {
      setStatus('¡Enviado a Roblox Studio!');
      setPrompt(''); // Limpiar input
    } else {
      setStatus('Error al generar.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
            MagicLua
          </h1>
          <p className="text-gray-400 mt-2">Tu varita mágica para Roblox</p>
        </div>

        {/* Display Session ID */}
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 text-center">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Session ID</p>
          <p className="font-mono text-xl text-green-400 tracking-wider mt-1 select-all">
            {sessionId}
          </p>
          <p className="text-xs text-gray-600 mt-2">
            Copia esto en tu Plugin de Roblox
          </p>
        </div>

        {/* Input Area */}
        <div className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ej: Crea una torre de cubos de neón rojo que caigan del cielo..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-lg focus:ring-2 focus:ring-purple-500 focus:outline-none min-h-[150px]"
          />
          
          <button
            onClick={handleSend}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              loading 
                ? 'bg-gray-700 cursor-not-allowed' 
                : 'bg-white text-black hover:bg-gray-200'
            }`}
          >
            {loading ? 'Creando...' : 'Hacer Magia ✨'}
          </button>
          
          <p className="text-center text-sm text-gray-500">{status}</p>
        </div>
      </div>
    </div>
  );
}
