import { useState, useEffect, useRef } from 'react';
import './index.css';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Send, LogOut, Hash, User, Paperclip, X } from "lucide-react";

const API_URL = 'http://localhost:8000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);

  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [msgContent, setMsgContent] = useState('');
  const [file, setFile] = useState(null);

  const messagesEndRef = useRef(null);

  const fetchWithAuth = async (endpoint, options = {}) => {
    const headers = { ...options.headers };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      headers['Accept'] = 'application/json';
    } else {
      headers['Accept'] = 'application/json';
    }

    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  };

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchWithAuth('/me')
        .then(data => setUser(data.user))
        .catch(() => handleLogout());
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      loadChannels();
    }
  }, [user]);

  useEffect(() => {
    if (activeChannel) {
      setMessages([]);
      setIsLoading(true);
      loadMessages().then(() => setIsLoading(false));
      const interval = setInterval(loadMessages, 3000); // Polling every 3s
      return () => clearInterval(interval);
    }
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChannels = async () => {
    try {
      const data = await fetchWithAuth('/channels');
      if (data.channels.length === 0) {
        const retryData = await fetchWithAuth('/channels');
        setChannels(retryData.channels);
        setActiveChannel(retryData.channels[0]);
      } else {
        setChannels(data.channels);
        if (!activeChannel) setActiveChannel(data.channels[0]);
      }
    } catch (e) {
      console.error('Failed to load channels', e);
    }
  };

  const loadMessages = async () => {
    if (!activeChannel) return;
    try {
      const data = await fetchWithAuth(`/channels/${activeChannel.id}/messages`);
      if (data.status === 'success') {
        const sorted = data.messages.sort((a, b) => a.id - b.id);
        const didChange = JSON.stringify(messages) !== JSON.stringify(sorted);
        if (didChange || messages.length === 0) {
          setMessages(sorted);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const endpoint = authMode === 'login' ? '/login' : '/register';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ name: username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Auth failed');

      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try { await fetchWithAuth('/logout', { method: 'POST' }); } catch (e) { }
    }
    setToken('');
    setUser(null);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!msgContent.trim() && !file) return;

    try {
      const formData = new FormData();
      if (msgContent.trim()) formData.append('content', msgContent.trim());
      if (file) formData.append('file', file);

      await fetchWithAuth(`/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        body: formData
      });
      setMsgContent('');
      setFile(null);
      loadMessages();
    } catch (e) {
      console.error('Send failed', e);
    }
  };

  if (!user || !token) {
    return (
      <div className="auth-overlay">
        <Card className="w-full max-w-md bg-zinc-950/80 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardHeader className="text-center pb-6">
            <CardTitle className="brand-font text-3xl font-extrabold pb-2 bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Nexus Hub</CardTitle>
            <CardDescription className="text-zinc-400 font-medium text-[15px]">Step into seamless collaboration.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full" onValueChange={(v) => { setAuthMode(v); setError(''); }}>
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-zinc-900/50 p-1 border border-white/5">
                <TabsTrigger value="login" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-zinc-400 transition-all font-semibold tracking-wide">LOGIN</TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-zinc-400 transition-all font-semibold tracking-wide">REGISTER</TabsTrigger>
              </TabsList>

              {error && (
                <div className="danger-text bg-red-500/10 text-red-500 text-sm p-3 rounded-md mb-6 border border-red-500/20 text-center font-medium shadow-sm">
                  {error}
                </div>
              )}

              <TabsContent value="login">
                <form className="space-y-5" onSubmit={handleAuth}>
                  <div className="space-y-2">
                    <Label className="text-zinc-300 font-semibold px-0.5">Username Handle</Label>
                    <Input
                      type="text"
                      placeholder="@username"
                      value={username}
                      className="bg-zinc-900 border-zinc-700/80 focus:border-violet-500 transition-all h-12 text-md shadow-inner text-zinc-200 placeholder:text-zinc-600 px-4"
                      onChange={e => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300 font-semibold px-0.5">Secure Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      className="bg-zinc-900 border-zinc-700/80 focus:border-violet-500 transition-all h-12 text-md shadow-inner text-zinc-200 placeholder:text-zinc-600 px-4"
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="pt-2">
                    <Button type="submit" className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-bold h-12 shadow-lg shadow-violet-500/25 transition-all outline-none rounded-lg text-md">
                      Access Hub
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form className="space-y-5" onSubmit={handleAuth}>
                  <div className="space-y-2">
                    <Label className="text-zinc-300 font-semibold px-0.5">Choose a Username</Label>
                    <Input
                      type="text"
                      placeholder="e.g. john_doe"
                      value={username}
                      className="bg-zinc-900 border-zinc-700/80 focus:border-violet-500 transition-all h-12 text-md shadow-inner text-zinc-200 placeholder:text-zinc-600 px-4"
                      onChange={e => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300 font-semibold px-0.5">Create a Password</Label>
                    <Input
                      type="password"
                      placeholder="Min. 6 characters"
                      value={password}
                      className="bg-zinc-900 border-zinc-700/80 focus:border-violet-500 transition-all h-12 text-md shadow-inner text-zinc-200 placeholder:text-zinc-600 px-4"
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="pt-2">
                    <Button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold h-12 shadow-lg shadow-cyan-500/20 transition-all outline-none rounded-lg text-md">
                      Create Account
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-container flex h-screen max-w-[1600px] mx-auto p-4 gap-4 box-border">
      {/* Sidebar Navigation */}
      <aside className="sidebar glass-panel w-72 flex flex-col rounded-[24px] overflow-hidden relative border border-white/5">
        <div className="sidebar-header brand-title p-6 border-b border-white/5 bg-black/20 flex items-center gap-2">
          <span className="brand-dot w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.6)]"></span>
          <span className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">Nexus</span>
          <span className="font-light text-xl text-zinc-500">Hub</span>
        </div>

        <div className="user-profile-badge p-6 border-b border-white/5 flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-11 w-11 shadow-lg border-2 border-zinc-800">
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-pink-500 text-white font-semibold flex items-center justify-center pt-1">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-zinc-900 rounded-full"></div>
          </div>
          <div className="user-info flex flex-col">
            <span className="font-semibold text-sm text-zinc-100">{user.name}</span>
            <span className="text-xs text-zinc-400 flex items-center gap-1">Online</span>
          </div>
        </div>

        <ScrollArea className="channel-section flex-1 px-4 py-6">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 pl-2">Channels</div>
          <ul className="space-y-1">
            {channels.map(c => (
              <li
                key={c.id}
                className={`channel-item px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-3 font-medium text-sm
                  ${activeChannel?.id === c.id
                    ? 'bg-violet-500/15 text-violet-400 border-l-2 border-violet-500'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
                  }`}
                onClick={() => setActiveChannel(c)}
              >
                <Hash className="w-4 h-4 opacity-70" /> {c.name}
              </li>
            ))}
          </ul>
        </ScrollArea>

        <div className="sidebar-footer p-4 border-t border-white/5 bg-black/20">
          <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-400/10 gap-2" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Communication Arena */}
      <main className="main-arena glass-panel flex-1 flex flex-col rounded-[24px] overflow-hidden border border-white/5 relative">
        <header className="channel-header p-5 px-8 border-b border-white/5 bg-black/30 flex items-center justify-between">
          <div>
            <h2 className="brand-font text-xl font-semibold flex items-center gap-2 m-0 text-zinc-100">
              <Hash className="text-violet-500 opacity-80 w-5 h-5" />
              {activeChannel?.name || 'loading...'}
            </h2>
            <div className="text-sm text-zinc-400 mt-1">
              Team communication for {activeChannel?.name}
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1 p-6 relative">
          <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pb-4">
            {isLoading ? (
              <div className="empty-state flex flex-col items-center justify-center py-20 text-zinc-500">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="empty-state flex flex-col items-center justify-center py-20 text-zinc-500">
                <Hash className="w-12 h-12 opacity-20 mb-4" />
                <p>Welcome to #{activeChannel?.name}. Start the conversation!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isOwn = msg.user?.id === user.id;

                return (
                  <div className={`flex gap-4 group animate-in fade-in slide-in-from-bottom-2 ${isOwn ? 'justify-end' : 'justify-start'}`} key={msg.id}>
                    {!isOwn && (
                      <Avatar className="h-9 w-9 mt-1 flex-shrink-0">
                        <AvatarFallback className="bg-zinc-800 text-zinc-300 text-sm">
                          {msg.user?.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className={`max-w-[75%] rounded-2xl p-4 flex flex-col gap-2 transition-all ${isOwn
                      ? 'bg-violet-600/20 hover:bg-violet-600/30 rounded-tr-sm border border-violet-500/10'
                      : 'bg-zinc-800/40 hover:bg-zinc-800/60 rounded-tl-sm border border-white/5'
                      }`}
                    >
                      <div className={`flex items-baseline gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        <span className="font-semibold text-sm text-zinc-200">{msg.user?.name}</span>
                        <span className="text-xs text-zinc-500">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {msg.content && (
                        <div className={`text-zinc-300 leading-relaxed text-[15px] max-w-none break-words ${isOwn ? 'text-right' : 'text-left'}`}>
                          {msg.content}
                        </div>
                      )}

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className={`flex flex-wrap gap-2 mt-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          {msg.attachments.map(att => (
                            <div key={att.id}>
                              {att.file_type.startsWith('image/') ? (
                                <a href={`http://localhost:8000${att.file_path}`} target="_blank" rel="noreferrer">
                                  <img src={`http://localhost:8000${att.file_path}`} className="max-w-[280px] max-h-[220px] rounded-lg border border-white/10 object-cover hover:scale-[1.02] transition-transform shadow-lg" alt="attachment" />
                                </a>
                              ) : (
                                <a href={`http://localhost:8000${att.file_path}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-black/20 hover:bg-black/40 border border-white/5 hover:border-violet-500/50 rounded-lg text-sm text-zinc-300 transition-colors">
                                  <Paperclip className="w-4 h-4" /> {att.file_path.split('/').pop()}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {isOwn && (
                      <Avatar className="h-9 w-9 mt-1 flex-shrink-0">
                        <AvatarFallback className="bg-violet-600 text-white text-sm">
                          {msg.user?.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </ScrollArea>

        <div className="composer-area p-5 px-8 bg-black/30 border-t border-white/5">
          {file && (
            <div className="file-preview flex items-center justify-between p-3 px-4 bg-violet-900/20 border border-violet-500/30 rounded-t-xl text-sm text-zinc-200">
              <span className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-violet-400" />
                <span className="opacity-90">{file.name}</span>
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-white" onClick={() => setFile(null)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
          <form className={`flex items-end gap-2 p-2 bg-black/40 border border-white/10 transition-all focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 focus-within:bg-black/60 shadow-inner ${file ? 'rounded-b-xl' : 'rounded-2xl'}`} onSubmit={sendMessage}>
            <input
              type="file"
              id="fileInput"
              className="hidden"
              onChange={e => setFile(e.target.files[0])}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-white hover:bg-white/10 shrink-0 h-11 w-11 rounded-xl"
              onClick={() => document.getElementById('fileInput').click()}
              title="Attach File"
            >
              <Paperclip className="w-5 h-5" />
            </Button>

            <Input
              type="text"
              className="flex-1 bg-transparent border-none text-zinc-100 shadow-none focus-visible:ring-0 placeholder:text-zinc-500 text-[15px] h-11 px-2"
              placeholder={`Message #${activeChannel?.name || 'channel'}`}
              value={msgContent}
              onChange={e => setMsgContent(e.target.value)}
            />

            <Button
              type="submit"
              size="icon"
              className="bg-violet-600 hover:bg-violet-500 text-white shrink-0 h-11 w-11 rounded-xl shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none transition-all"
              disabled={!msgContent.trim() && !file}
            >
              <Send className="w-5 h-5 ml-0.5" />
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default App;
