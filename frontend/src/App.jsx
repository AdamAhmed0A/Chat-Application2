import { useState, useEffect, useRef } from 'react';
import './index.css';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Send, LogOut, Hash, User, Paperclip, X, Sparkles, Coffee, Bookmark, Settings, Bell, Shield, Paintbrush } from "lucide-react";

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

  // Next-Gen Feature States
  const [isNoPressure, setIsNoPressure] = useState(false);
  const [aiTone, setAiTone] = useState('Neutral');
  const [showAiMenu, setShowAiMenu] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('');

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
        .then(data => {
          setUser(data.user);
          setEditName(data.user.name || '');
          setEditStatus(data.user.status_message || '');
        })
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

  const handleUpdateProfile = async () => {
    try {
      const resp = await fetchWithAuth('/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName,
          status_message: editStatus,
        })
      });
      setUser(resp.user);
      setIsSettingsOpen(false);
    } catch (e) {
      console.error('Failed to update profile', e);
    }
  };

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

      let finalContent = msgContent.trim();

      // Simulated Next-Gen Feature Parsing
      if (aiTone !== 'Neutral' && finalContent) {
        finalContent = `[AI ${aiTone}] ${finalContent}`;
      }
      if (isNoPressure) {
        finalContent = `🌿 (No Rush) ${finalContent}`;
      }

      if (finalContent) formData.append('content', finalContent);
      if (file) formData.append('file', file);

      await fetchWithAuth(`/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        body: formData
      });
      setMsgContent('');
      setFile(null);
      setIsNoPressure(false);
      setAiTone('Neutral');
      loadMessages();
    } catch (e) {
      console.error('Send failed', e);
    }
  };

  if (!user || !token) {
    return (
      <div className="auth-overlay bg-black relative flex w-full h-full items-center justify-center overflow-hidden">
        {/* Animated Radial Background Gradients for depth */}
        <div className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-violet-600/20 blur-[140px] rounded-full pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-1/4 right-1/4 w-[40rem] h-[40rem] bg-cyan-600/15 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />

        <Card className="w-full max-w-md bg-zinc-950/70 backdrop-blur-2xl border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.8)] z-10 mx-4">
          <CardHeader className="text-center pb-6 pt-8">
            <div className="mx-auto bg-violet-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner relative border border-white/5">
              <Hash className="w-8 h-8 text-violet-400 opacity-90" />
              <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full" />
            </div>
            <CardTitle className="brand-font text-4xl font-extrabold pb-1 bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">Nexus Hub</CardTitle>
            <CardDescription className="text-zinc-400/90 font-medium text-[15px] mt-2">Step into seamless collaboration.</CardDescription>
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

              <TabsContent value="login" className="mt-0 outline-none">
                <form className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300" onSubmit={handleAuth}>
                  <div className="space-y-2.5">
                    <Label className="text-zinc-300 font-semibold px-0.5 text-sm tracking-wide">Username Handle</Label>
                    <Input
                      type="text"
                      placeholder="@username"
                      value={username}
                      className="bg-black/40 border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all h-12 text-[15px] shadow-inner text-zinc-100 placeholder:text-zinc-600 px-4 rounded-xl"
                      onChange={e => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label className="text-zinc-300 font-semibold px-0.5 text-sm tracking-wide">Secure Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      className="bg-black/40 border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all h-12 text-[15px] shadow-inner text-zinc-100 placeholder:text-zinc-600 px-4 rounded-xl"
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="pt-4 pb-2">
                    <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold h-12 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all outline-none rounded-xl text-[15px]">
                      Access Hub
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-0 outline-none">
                <form className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300" onSubmit={handleAuth}>
                  <div className="space-y-2.5">
                    <Label className="text-zinc-300 font-semibold px-0.5 text-sm tracking-wide">Choose a Username</Label>
                    <Input
                      type="text"
                      placeholder="e.g. creative_mind"
                      value={username}
                      className="bg-black/40 border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all h-12 text-[15px] shadow-inner text-zinc-100 placeholder:text-zinc-600 px-4 rounded-xl"
                      onChange={e => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label className="text-zinc-300 font-semibold px-0.5 text-sm tracking-wide">Create a Password</Label>
                    <Input
                      type="password"
                      placeholder="Min. 6 characters"
                      value={password}
                      className="bg-black/40 border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all h-12 text-[15px] shadow-inner text-zinc-100 placeholder:text-zinc-600 px-4 rounded-xl"
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="pt-4 pb-2">
                    <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-12 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all outline-none rounded-xl text-[15px]">
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
          <div className="user-info flex flex-col w-[160px]">
            <span className="font-semibold text-sm text-zinc-100 truncate">{user.name}</span>
            <span className="text-xs text-zinc-400 flex items-center gap-1 truncate w-full" title={user.status_message || "Online"}>
              {user.status_message || "Online"}
            </span>
          </div>
        </div>

        <ScrollArea className="channel-section flex-1 px-4 py-6">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 pl-2">Me</div>
          <ul className="space-y-1 mb-6">
            {channels.filter(c => c.is_saved).map(c => (
              <li
                key={c.id}
                className={`channel-item px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-3 font-medium text-sm
                  ${activeChannel?.id === c.id
                    ? 'bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-500 shadow-sm'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
                  }`}
                onClick={() => setActiveChannel(c)}
              >
                <Bookmark className="w-4 h-4 opacity-70" /> {c.name}
              </li>
            ))}
          </ul>

          <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 pl-2">Channels</div>
          <ul className="space-y-1">
            {channels.filter(c => !c.is_saved).map(c => (
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

        <div className="sidebar-footer p-4 border-t border-white/5 bg-black/20 flex flex-col gap-2">

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-white/10 gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl bg-zinc-950/95 backdrop-blur-3xl border-white/10 text-white shadow-2xl p-0 gap-0 overflow-hidden rounded-2xl">
              <div className="flex h-[500px]">
                {/* Settings Sidebar */}
                <div className="w-48 bg-black/40 border-r border-white/5 p-4 flex flex-col gap-1">
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 pl-2 mt-2">Preferences</div>
                  <Button variant="ghost" className={`w-full justify-start gap-2 text-sm ${settingsTab === 'profile' ? 'bg-violet-500/15 text-violet-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`} onClick={() => setSettingsTab('profile')}>
                    <User className="w-4 h-4" /> Profile
                  </Button>
                  <Button variant="ghost" className={`w-full justify-start gap-2 text-sm ${settingsTab === 'appearance' ? 'bg-violet-500/15 text-violet-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`} onClick={() => setSettingsTab('appearance')}>
                    <Paintbrush className="w-4 h-4" /> Appearance
                  </Button>
                  <Button variant="ghost" className={`w-full justify-start gap-2 text-sm ${settingsTab === 'privacy' ? 'bg-violet-500/15 text-violet-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`} onClick={() => setSettingsTab('privacy')}>
                    <Shield className="w-4 h-4" /> Privacy & Security
                  </Button>
                  <Button variant="ghost" className={`w-full justify-start gap-2 text-sm ${settingsTab === 'notifications' ? 'bg-violet-500/15 text-violet-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`} onClick={() => setSettingsTab('notifications')}>
                    <Bell className="w-4 h-4" /> Notifications
                  </Button>
                </div>

                {/* Settings Content Pane */}
                <div className="flex-1 p-6 flex flex-col">
                  {settingsTab === 'profile' && (
                    <>
                      <DialogHeader className="mb-6">
                        <DialogTitle className="text-xl font-bold tracking-wide">Profile Settings</DialogTitle>
                        <DialogDescription className="text-zinc-400">Manage your Nexus Hub account identity.</DialogDescription>
                      </DialogHeader>

                      <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-6">
                          <Avatar className="h-20 w-20 shadow-lg border-2 border-zinc-800">
                            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-pink-500 text-white text-2xl font-bold">
                              {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white">Change Avatar</Button>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs uppercase tracking-wider">Display Name</Label>
                            <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-black/50 border-zinc-800 h-11 focus:border-violet-500" />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-zinc-400 text-xs uppercase tracking-wider">Status Message</Label>
                            <Input value={editStatus} onChange={e => setEditStatus(e.target.value)} placeholder="What's on your mind?" className="bg-black/50 border-zinc-800 h-11 focus:border-violet-500" />
                          </div>

                          <div className="pt-4 flex justify-end">
                            <Button className="bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25 px-8 transition-all" onClick={handleUpdateProfile} disabled={!editName.trim()}>Save Changes</Button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {settingsTab !== 'profile' && (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 h-full">
                      <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                      <p className="font-medium text-[15px]">Coming Soon</p>
                      <p className="text-sm opacity-60 max-w-[200px] text-center mt-2">These settings are being crafted for the next major release.</p>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
              {activeChannel?.is_saved ? <Bookmark className="text-emerald-500 opacity-80 w-5 h-5" /> : <Hash className="text-violet-500 opacity-80 w-5 h-5" />}
              {activeChannel?.name || 'loading...'}
            </h2>
            <div className="text-sm text-zinc-400 mt-1">
              {activeChannel?.is_saved ? 'Your private space for notes and files.' : `Team communication for ${activeChannel?.name}`}
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
                {activeChannel?.is_saved ? <Bookmark className="w-12 h-12 opacity-20 mb-4" /> : <Hash className="w-12 h-12 opacity-20 mb-4" />}
                <p>{activeChannel?.is_saved ? "Send messages to yourself to save them for later." : `Welcome to #${activeChannel?.name}. Start the conversation!`}</p>
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
          <form className={`flex flex-col gap-2 p-3 bg-black/40 border transition-all ${isNoPressure ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-white/10 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500'} ${file ? 'rounded-b-xl' : 'rounded-2xl'}`} onSubmit={sendMessage}>

            {/* Context Actions Row (Next Gen Features) */}
            <div className="flex items-center justify-between px-1 mb-1 relative">
              <div className="flex items-center gap-3">
                {/* AI Tone Changer */}
                <div className="relative">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2 gap-1.5 bg-violet-500/10 text-violet-400 hover:text-violet-300 hover:bg-violet-500/20 rounded-md border border-violet-500/20" onClick={() => setShowAiMenu(!showAiMenu)}>
                    <Sparkles className="w-3.5 h-3.5" />
                    Tone: {aiTone}
                  </Button>

                  {showAiMenu && (
                    <div className="absolute bottom-8 left-0 mb-1 w-48 bg-zinc-900 border border-white/10 rounded-xl p-2 shadow-2xl z-50 flex flex-col gap-1">
                      <div className="text-[10px] font-bold uppercase text-zinc-500 px-2 py-1 tracking-wider">AI Rewrite</div>
                      {['Professional', 'Casual', 'Empathetic', 'Direct', 'Neutral'].map(tone => (
                        <button key={tone} type="button" className={`text-left text-sm px-3 py-1.5 rounded-md transition-colors ${aiTone === tone ? 'text-violet-400 bg-violet-500/10 font-medium' : 'text-zinc-300 hover:bg-white/5'}`} onClick={() => { setAiTone(tone); setShowAiMenu(false); }}>
                          {tone}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Anxiety-Free Delivery */}
                <button type="button" onClick={() => setIsNoPressure(!isNoPressure)} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-all border ${isNoPressure ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-transparent text-zinc-500 border-transparent hover:bg-white/5 hover:text-zinc-300'}`}>
                  <Coffee className="w-3.5 h-3.5" />
                  No-Pressure Delivery
                </button>
              </div>
            </div>

            <div className="flex items-end gap-2 w-full">
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
                className={`shrink-0 h-11 w-11 rounded-xl transition-colors ${isNoPressure ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
                onClick={() => document.getElementById('fileInput').click()}
                title="Attach File"
              >
                <Paperclip className="w-5 h-5" />
              </Button>

              <Input
                type="text"
                className="flex-1 bg-transparent border-none text-zinc-100 shadow-none focus-visible:ring-0 placeholder:text-zinc-500 placeholder:italic text-[15px] h-11 px-2"
                placeholder={isNoPressure ? "Take your time... this message will be delivered silently." : `Message #${activeChannel?.name || 'channel'}...`}
                value={msgContent}
                onChange={e => setMsgContent(e.target.value)}
              />

              <Button
                type="submit"
                size="icon"
                className={`shrink-0 h-11 w-11 rounded-xl shadow-lg disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none transition-all ${isNoPressure ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/25 text-white' : 'bg-violet-600 hover:bg-violet-500 shadow-violet-500/25 text-white'}`}
                disabled={!msgContent.trim() && !file}
              >
                <Send className="w-5 h-5 ml-0.5" />
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default App;
