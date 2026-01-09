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

type Script = {
  name: string;
  path: string;
  type: string;
};

export default function MagicLuaChat() {
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('magiclua_session_v5');
    if (stored) setSessionId(stored);
    else {
      const newId = uuidv4();
      setSessionId(newId);
      localStorage.setItem('magiclua_session_v5', newId);
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStep]);

  // Obtener scripts del plugin cada 5 segundos
  useEffect(() => {
    if (!sessionId) return;
    
    const fetchScripts = async () => {
      try {
        const res = await fetch(`/api/scripts?sessionId=${sessionId}`);
        const data = await res.json();
        setScripts(data.scripts || []);
      } catch (e) {
        console.error('Error fetching scripts:', e);
      }
    };

    fetchScripts();
    const interval = setInterval(fetchScripts, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
  };

  const handleSend = async (text: string, action: 'plan' | 'execute' = 'plan') => {
    if (!text.trim()) return;

    const userMsg: Message = { id: uuidv4(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setCurrentStep('Connecting...');

    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          sessionId,
          action
        })
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
            setCurrentStep(json.data.message);
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
          } else if (json.type === 'error') {
            setMessages(prev => [...prev, {
              id: uuidv4(),
              role: 'ai',
              content: `❌ Error: ${json.data.message}`
            }]);
            setLoading(false);
          }
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'ai',
        content: '❌ Connection error. Check console.'
      }]);
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#0a0a0b] via-[#12121 4] to-[#0f0f11] text-gray-200 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-80 border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-2xl shadow-2xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="relative w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.4)] flex items-center justify-center">
              <span className="text-black font-black text-xl">M</span>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h1 className="font-black text-xl text-white tracking-tight">MagicLua</h1>
              <p className="text-[10px] text-gray-600 font-medium">Professional Edition</p>
            </div>
          </div>
          
          {/* Session ID */}
          <div className="bg-gradient-to-br from-[#1a1a1d] to-[#151518] border border-white/10 rounded-xl p-4 mb-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Session</p>
              <button onClick={copySessionId} className="text-gray-500 hover:text-green-400 transition-colors text-xs">
                📋
              </button>
            </div>
            <code className="text-xs text-green-400 font-mono block truncate opacity-90">{sessionId}</code>
          </div>
          
          {/* Scripts List */}
          <div className="bg-gradient-to-br from-[#1a1a1d] to-[#151518] border border-white/10 rounded-xl p-4 shadow-lg max-h-[calc(100vh-400px)] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Game Scripts</p>
              <span className="text-[10px] text-gray-600">{scripts.length} files</span>
            </div>
            
            {scripts.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-8">No scripts synced yet...</p>
            ) : (
              <div className="space-y-1">
                {scripts.map((script, i) => (
                  <div key={i} className="group px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
                    <p className="text-xs text-gray-300 font-medium truncate">{script.name}</p>
                    <p className="text-[10px] text-gray-600 truncate">{script.type}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* New Conversation */}
          <button
            onClick={() => {
              setMessages([]);
              localStorage.removeItem('magiclua_session_v5');
              window.location.reload();
            }}
            className="w-full mt-4 py-2 px-4 text-xs font-medium text-gray-400 border border-white/5 rounded-lg hover:bg-white/5 hover:text-white hover:border-white/10 transition-all"
          >
            + New Conversation
          </button>
        </div>
        
        <div className="mt-auto p-6 border-t border-white/5">
          <p className="text-[10px] text-gray-700 font-mono">v5.0.0 Professional</p>
        </div>
      </aside>

      {/* CHAT AREA */}
      <main className="flex-1 flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 scroll-smooth">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-700">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center mb-4 shadow-2xl shadow-yellow-500/20">
                  <span className="text-4xl">✨</span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                  <span className="text-white text-sm">AI</span>
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-black text-white mb-2">What should we build today?</h2>
                <p className="text-gray-500 text-sm">Describe any game mechanic and I'll code it for you</p>
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-2xl w-full mt-6">
                {[
                  { icon: '🎒', text: 'Inventory system' },
                  { icon: '🤖', text: 'Following NPC' },
                  { icon: '🛒', text: 'Weapon shop' },
                  { icon: '🌙', text: 'Day/night cycle' }
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(example.text)}
                    className="group p-4 bg-gradient-to-br from-[#1a1a1d] to-[#151518] border border-white/5 rounded-xl hover:border-yellow-500/30 hover:shadow-lg hover:shadow-yellow-500/10 transition-all text-left"
                  >
                    <div className="text-2xl mb-2">{example.icon}</div>
                    <p className="text-sm text-gray-400 group-hover:text-yellow-400 transition-colors">{example.text}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 fade-in duration-500`}>
              <div className={`max-w-3xl rounded-2xl p-6 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-yellow-500 to-orange-500 text-black shadow-xl shadow-yellow-500/20'
                  : 'bg-gradient-to-br from-[#1a1a1d] to-[#151518] border border-white/5'
              }`}>
                {msg.role === 'ai' && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center">
                      <span className="text-black text-xs font-bold">AI</span>
                    </div>
                    <span className="text-sm font-bold text-gray-300">MagicLua</span>
                  </div>
                )}

                <div className={`prose ${msg.role === 'user' ? 'prose-invert prose-yellow' : 'prose-invert'} prose-sm max-w-none`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {msg.type === 'plan' && (
                  <div className="mt-6 flex gap-3 pt-4 border-t border-white/10">
                    <button
                      onClick={() => handleSend("I don't like it, change the approach.", 'plan')}
                      className="px-4 py-2 text-xs font-medium text-gray-400 bg-white/5 rounded-lg hover:bg-white/10 hover:text-white transition-all"
                    >
                      Refine Plan
                    </button>
                    <button
                      onClick={() => handleSend("The plan is perfect. Generate the code.", 'execute')}
                      className="px-5 py-2 text-xs font-bold text-black bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg hover:from-yellow-300 hover:to-orange-400 transition-all shadow-lg shadow-yellow-500/20 flex items-center gap-2"
                    >
                      <span>🚀</span> Approve & Generate
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start animate-in slide-in-from-bottom-4 fade-in duration-300">
              <div className="flex items-center gap-3 bg-gradient-to-br from-[#1a1a1d] to-[#151518] border border-white/5 py-3 px-5 rounded-2xl shadow-xl">
                <div className="relative flex items-center justify-center">
                  <div className="w-3 h-3 bg-yellow-400 rounded-full animate-ping absolute"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                </div>
                <span className="font-mono text-xs text-gray-400">{currentStep}</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-6 mx-auto w-full max-w-4xl">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-500"></div>
            <div className="relative flex items-center bg-gradient-to-br from-[#1a1a1d] to-[#151518] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend(input)}
                placeholder="Describe your mechanic or change..."
                className="flex-1 bg-transparent py-4 px-6 text-white placeholder-gray-600 focus:outline-none"
                disabled={loading}
              />
              <button
                onClick={() => handleSend(input)}
                disabled={loading || !input.trim()}
                className="p-3 m-2 bg-gradient-to-br from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 rounded-lg text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-gray-700 mt-4 font-mono">
            MagicLua v5.0 Professional • Powered by Gemini 2.5 Flash
          </p>
        </div>
      </main>
    </div>
  );
}
