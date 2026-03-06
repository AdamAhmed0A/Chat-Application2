import { useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import Echo from 'laravel-echo';
import './index.css';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Paperclip, User, Star, Clock, Eye, Tag, Phone, CloudUpload, MessageSquare, CheckCircle, LayoutTemplate, Send, MoreVertical, Shield, Sparkles, LogOut, Loader2, Bookmark, Hash, ChevronRight, Activity, Bell, Trash2, Edit2, Smile, Forward, X, Image as ImageIcon, Gift, Check, CheckCheck } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmojiPicker from 'emoji-picker-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const STICKERS = [
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Beaming%20Face%20with%20Smiling%20Eyes.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Face%20Blowing%20a%20Kiss.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Face%20with%20Tears%20of%20Joy.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Waving%20Hand.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Hand%20gestures/Clapping%20Hands.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Red%20Heart.png'
];

// API Config
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [msgContent, setMsgContent] = useState('');
  const [file, setFile] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [profileAvatar, setProfileAvatar] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editContent, setEditContent] = useState('');

  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState([]);

  // Anxiety Features
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);
  const typingCheckoutsRef = useRef({});

  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesRef = useRef([]);
  const activeChannelRef = useRef(null);
  const echoRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  useEffect(() => {
    if (token) {
      window.Pusher = Pusher;
      echoRef.current = new Echo({
        broadcaster: 'reverb',
        key: 'cxcconqzctz4apkmlwhz',
        wsHost: 'localhost',
        wsPort: 8080,
        wssPort: 8080,
        forceTLS: false,
        enabledTransports: ['ws', 'wss']
      });
    }

    return () => {
      if (echoRef.current) {
        echoRef.current.disconnect();
      }
    };
  }, [token]);

  const fetchWithAuth = async (endpoint, options = {}) => {
    const currentToken = localStorage.getItem('token') || token;
    const headers = { ...options.headers };
    if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;
    if (echoRef.current && echoRef.current.socketId()) {
      headers['X-Socket-ID'] = echoRef.current.socketId();
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      headers['Accept'] = 'application/json';
    } else {
      headers['Accept'] = 'application/json';
    }

    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (res.status === 401 && endpoint !== '/logout') {
      localStorage.removeItem('token');
      setToken('');
      setUser(null);
      throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  };

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchWithAuth('/me')
        .then(data => {
          setUser(data.user);
        })
        .catch(() => handleLogout());
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  // Global presence and UserStatusChanged
  useEffect(() => {
    if (!user || !echoRef.current) return;

    // Listen to global status updates
    const globalChannel = echoRef.current.channel('global-events');
    globalChannel.listen('UserStatusChanged', (e) => {
      setChannels(prev => prev.map(c => {
        if (c.other_user_id === e.userId) {
          return {
            ...c,
            is_online: e.status === 'online',
            last_seen: e.status === 'idle' ? 'Idle' : (e.status === 'online' ? 'Online' : 'Recently')
          };
        }
        return c;
      }));
    });

    // Detect own idle state
    let idleTimeout;
    const resetIdle = () => {
      clearTimeout(idleTimeout);
      setUser(prev => {
        if (prev?.presence_status === 'idle') {
          fetchWithAuth('/me/presence', { method: 'PUT', body: JSON.stringify({ presence_status: 'online' }) }).catch(() => { });
          return { ...prev, presence_status: 'online' };
        }
        return prev;
      });
      idleTimeout = setTimeout(() => {
        fetchWithAuth('/me/presence', { method: 'PUT', body: JSON.stringify({ presence_status: 'idle' }) })
          .then(() => setUser(prev => ({ ...prev, presence_status: 'idle' })))
          .catch(() => { });
      }, 5 * 60 * 1000); // 5 minutes
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    resetIdle();

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('keydown', resetIdle);
      clearTimeout(idleTimeout);
      echoRef.current.leave('global-events');
    };
  }, [user, token]);

  useEffect(() => {
    if (user) loadChannels();
  }, [user]);


  useEffect(() => {
    if (activeChannel && echoRef.current) {
      const channel = echoRef.current.channel(`channel.${activeChannel.id}`);

      channel.listen('MessageEvent', (e) => {
        const { type, message } = e;

        if (type === 'typing') {
          setTypingUsers(prev => ({
            ...prev,
            [activeChannel.id]: {
              ...prev[activeChannel.id],
              [message.user.id]: message.user.name
            }
          }));
          if (typingCheckoutsRef.current[message.user.id]) {
            clearTimeout(typingCheckoutsRef.current[message.user.id]);
          }
          typingCheckoutsRef.current[message.user.id] = setTimeout(() => {
            setTypingUsers(prev => {
              const newT = { ...prev };
              if (newT[activeChannel.id]) {
                delete newT[activeChannel.id][message.user.id];
              }
              return newT;
            });
          }, 3000);
          return;
        }

        setMessages(prev => {
          if (type === 'new') {
            if (activeChannel.id === message.channel_id) {
              fetchWithAuth(`/channels/${activeChannel.id}/read`, { method: 'POST' }).catch(() => { });
            }
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
          }
          else if (type === 'updated' || type === 'reacted') {
            return prev.map(m => m.id === message.id ? message : m);
          }
          else if (type === 'deleted') {
            return prev.filter(m => m.id !== message.id);
          }
          return prev;
        });
      });

      return () => {
        channel.stopListening('MessageEvent');
        echoRef.current.leave(`channel.${activeChannel.id}`);
      };
    }
  }, [activeChannel, token]);

  useEffect(() => {
    if (activeChannel) {
      setMessages([]);
      setIsLoading(true);
      setShowRightSidebar(false); // Reset sidebar on channel change
      loadMessages(true).then(() => {
        setIsLoading(false);
        fetchWithAuth(`/channels/${activeChannel.id}/read`, { method: 'POST' }).catch(() => { });
      });
    }
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const fetchGifs = async () => {
      try {
        const url = gifSearch
          ? `https://g.tenor.com/v1/search?q=${gifSearch}&key=LIVDSRZULELA&limit=12`
          : `https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=12`;
        const res = await fetch(url);
        const data = await res.json();
        setGifResults(data.results || []);
      } catch (e) { console.error('Error fetching GIFs', e); }
    };
    const timeout = setTimeout(fetchGifs, 500);
    return () => clearTimeout(timeout);
  }, [gifSearch]);

  const loadChannels = async () => {
    try {
      const data = await fetchWithAuth('/channels');
      setChannels(data.channels);
    } catch (e) {
      console.error('Load channels failed', e);
    }
  };

  const loadMessages = async (forceFull = false) => {
    const channel = activeChannelRef.current;
    if (!channel) return;
    try {
      const currentMessages = messagesRef.current;
      let realLastId = 0;
      if (!forceFull && currentMessages.length > 0) {
        for (let i = currentMessages.length - 1; i >= 0; i--) {
          if (typeof currentMessages[i].id === 'number' && currentMessages[i].id < 1000000000000) {
            realLastId = currentMessages[i].id;
            break;
          }
        }
      }

      const url = realLastId ? `/channels/${channel.id}/messages?last_id=${realLastId}` : `/channels/${channel.id}/messages`;
      const data = await fetchWithAuth(url);
      if (data.status === 'success') {
        if (data.messages.length > 0 || forceFull) {
          setMessages(prev => {
            if (forceFull) return data.messages.sort((a, b) => a.id - b.id);
            const newMessages = [...prev];
            data.messages.forEach(m => {
              if (!newMessages.find(nm => nm.id === m.id)) newMessages.push(m);
            });
            return newMessages.sort((a, b) => a.id - b.id);
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchUsers = async (q) => {
    setSearchQuery(q);
    if (q.trim().length >= 2) {
      setIsSearchingUsers(true);
      try {
        const data = await fetchWithAuth(`/users/search?q=${q}`);
        setSearchResults(data.users || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearchingUsers(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleChannelClick = async (c) => {
    setActiveChannel(c);
    if (c.unread_count > 0) {
      setChannels(prev => prev.map(ch => ch.id === c.id ? { ...ch, unread_count: 0 } : ch));
      try {
        await fetchWithAuth(`/channels/${c.id}/read`, { method: 'POST' });
      } catch (e) { }
    }
  };

  const startDM = async (targetUserId) => {
    try {
      const data = await fetchWithAuth('/channels/direct', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetUserId })
      });
      if (data.status === 'success') {
        setSearchQuery('');
        setSearchResults([]);
        if (!channels.some(c => c.id === data.channel.id)) {
          setChannels(prev => [data.channel, ...prev]);
        }
        handleChannelClick(data.channel);
        toast.success(`Started conversation with ${data.channel.name}`);
      }
    } catch (e) {
      toast.error('Failed to start conversation');
    }
  };

  const handleAiGenerate = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

      const systemInstruction = `You are a professional message composer. The user will describe what they want to say to someone, and you must write a clear, natural, well-phrased message that they can send. Only output the message text itself — no explanations, no quotes, no labels. Write it as if you are the user speaking directly.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{ parts: [{ text: aiPrompt }] }]
          })
        }
      );

      const data = await res.json();
      if (!res.ok) {
        if (data.error?.message?.includes('Quota exceeded')) {
          throw new Error('You are sending messages too quickly (Rate limit hit). Please wait a few seconds and try again.');
        }
        throw new Error(data.error?.message || 'Gemini API error');
      }

      const generated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (generated) {
        setMsgContent(generated);
        setShowAiDialog(false);
        setAiPrompt('');
        toast.success('AI drafted a message. Review and send when ready!');
      } else {
        toast.error('AI returned an empty response.');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error contacting AI assistant.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      if (profileName) formData.append('name', profileName);
      if (profileStatus) formData.append('status_message', profileStatus);
      if (profileAvatar) formData.append('avatar', profileAvatar);

      const data = await fetchWithAuth('/me', { method: 'POST', body: formData });
      setUser(data.user);
      setShowSettings(false);
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile');
    }
  };

  const openSettings = () => {
    setProfileName(user.name || '');
    setProfileStatus(user.status_message || '');
    setProfileAvatar(null);
    setShowSettings(true);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const endpoint = authMode === 'login' ? '/login' : '/register';
      const bodyPayload = authMode === 'login'
        ? { email, password }
        : { name: username, email, password };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Auth failed');
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      toast.success(authMode === 'login' ? 'Logged in successfully!' : 'Account created!');
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Authentication failed');
    }
  };

  const handleLogout = async () => {
    if (token) {
      try { await fetchWithAuth('/logout', { method: 'POST' }); } catch (e) { }
    }
    setToken('');
    setUser(null);
    setAuthMode('login');
    toast.info('Logged out successfully');
  };

  const handleTyping = (val) => {
    setMsgContent(val);
    if (!typingTimeoutRef.current && activeChannelRef.current) {
      fetchWithAuth(`/channels/${activeChannelRef.current.id}/typing`, { method: 'POST' }).catch(() => { });
      typingTimeoutRef.current = setTimeout(() => {
        typingTimeoutRef.current = null;
      }, 2000);
    }
  };

  const sendMessage = async (e, directContent = null) => {
    if (e) e.preventDefault();
    const targetContent = directContent !== null ? directContent : msgContent;
    const targetFile = directContent !== null ? null : file;

    if (!targetContent.trim() && !targetFile) return;

    const currentChannel = activeChannelRef.current;
    let finalContent = targetContent.trim();

    const tempId = Date.now();
    const tempMessage = {
      id: tempId,
      user: user,
      content: finalContent,
      created_at: new Date().toISOString(),
      attachments: targetFile ? [{ id: tempId, file_path: '', file_type: targetFile.type || 'file', __name: targetFile.name }] : []
    };

    setMessages(prev => [...prev, tempMessage]);
    if (directContent === null) {
      setMsgContent('');
      setFile(null);
    }
    const currentFile = targetFile;

    try {
      const formData = new FormData();
      if (finalContent) formData.append('content', finalContent);
      if (currentFile) formData.append('file', currentFile);

      const data = await fetchWithAuth(`/channels/${currentChannel.id}/messages`, { method: 'POST', body: formData });

      setMessages(prev => {
        const newMessages = [...prev];
        const tempIndex = newMessages.findIndex(m => m.id === tempId);
        if (tempIndex !== -1) {
          const alreadyHasReal = newMessages.some(m => m.id === data.message.id);
          if (alreadyHasReal) {
            newMessages.splice(tempIndex, 1);
          } else {
            newMessages[tempIndex] = data.message;
          }
        } else if (!newMessages.some(m => m.id === data.message.id)) {
          newMessages.push(data.message);
        }
        return newMessages;
      });
    } catch (e) {
      console.error('Send failed', e);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  if (!user || !token) {
    return (
      <>
        <Toaster position="top-center" richColors />

        {/* Animated Background */}
        <div className="fixed inset-0 bg-[#0a0a0e] overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-pink-500/10 blur-[150px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '6s' }}></div>
          <div className="bg-wallpaper absolute inset-0 opacity-10 bg-cover bg-center mix-blend-screen"></div>
        </div>

        <div className="w-full h-full relative flex items-center justify-center min-h-[100vh] p-4 sm:p-8">
          <div className="flex flex-col lg:flex-row w-full max-w-5xl bg-[#121218]/80 border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.8)] z-10 rounded-[32px] overflow-hidden text-white backdrop-blur-3xl animate-in zoom-in-95 duration-500">

            {/* Left side: Branding / Visual */}
            <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden bg-gradient-to-br from-white/[0.03] to-transparent border-r border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-transparent"></div>
              <div className="absolute -left-10 -top-10 w-40 h-40 bg-pink-500/30 blur-[80px] rounded-full"></div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="brand-font text-3xl font-black text-white tracking-tight">NexusHub</h1>
                </div>
                <h2 className="text-5xl font-black leading-tight mt-16 bg-clip-text text-transparent bg-gradient-to-br from-white via-zinc-200 to-zinc-500">
                  Connect.<br />Collaborate.<br />Create.
                </h2>
                <p className="text-zinc-400 mt-6 text-base max-w-sm leading-relaxed font-medium">
                  Join a future-proof workspace designed for modern dynamic teams. Experience real-time communication that feels simply magical.
                </p>
              </div>

              <div className="relative z-10 flex items-center gap-4 border border-white/10 bg-black/30 p-4 rounded-2xl backdrop-blur-md mt-16 shadow-xl">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`w-10 h-10 rounded-full border-2 border-[#121218] bg-gradient-to-br ${i % 2 === 0 ? 'from-pink-500 to-purple-500' : 'from-indigo-500 to-cyan-500'} flex items-center justify-center shadow-sm`}>
                      <User className="w-4 h-4 text-white/50" />
                    </div>
                  ))}
                </div>
                <div className="text-sm font-semibold text-zinc-300">
                  Join <span className="text-white font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">10,000+</span> creators
                </div>
              </div>
            </div>

            {/* Right side: Login/Register Form */}
            <div className="w-full lg:w-1/2 p-8 sm:p-12 flex flex-col justify-center relative bg-[#0d0d12]/50">
              <div className="absolute top-1/2 right-[-20%] -translate-y-1/2 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none"></div>

              <div className="w-full max-w-sm mx-auto relative z-10">
                <div className="text-center lg:text-left mb-8">
                  <h3 className="text-3xl font-black text-white mb-2 tracking-tight">Welcome</h3>
                  <p className="text-zinc-400 text-sm font-medium">Enter your details to access the workspace.</p>
                </div>

                <Tabs value={authMode} className="w-full" onValueChange={(v) => { setAuthMode(v); setError(''); }}>
                  <TabsList className="grid w-full grid-cols-2 mb-8 bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                    <TabsTrigger value="login" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-purple-500 rounded-xl text-zinc-400 data-[state=active]:text-white font-bold h-11 transition-all text-sm tracking-wide">LOGIN</TabsTrigger>
                    <TabsTrigger value="register" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-purple-500 rounded-xl text-zinc-400 data-[state=active]:text-white font-bold h-11 transition-all text-sm tracking-wide">REGISTER</TabsTrigger>
                  </TabsList>

                  {error && <div className="bg-red-500/10 text-red-400 text-sm p-4 rounded-2xl mb-6 border border-red-500/20 text-center font-medium shadow-sm animate-in fade-in">{error}</div>}

                  <TabsContent value="login" className="mt-0 outline-none animate-in slide-in-from-left-4 fade-in duration-300">
                    <form className="space-y-5" onSubmit={handleAuth}>
                      <div className="space-y-2 group">
                        <Label className="text-zinc-400 px-1 text-[11px] uppercase tracking-wider font-bold group-focus-within:text-purple-400 transition-colors">Email Address</Label>
                        <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="pl-4 bg-black/40 border-white/5 focus-visible:border-purple-500 focus-visible:ring-1 focus-visible:ring-purple-500 h-14 text-[15px] text-white rounded-2xl transition-all placeholder:text-zinc-600 shadow-inner" />
                      </div>
                      <div className="space-y-2 group">
                        <div className="flex items-center justify-between px-1">
                          <Label className="text-zinc-400 text-[11px] uppercase tracking-wider font-bold group-focus-within:text-purple-400 transition-colors">Password</Label>
                        </div>
                        <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="pl-4 bg-black/40 border-white/5 focus-visible:border-purple-500 focus-visible:ring-1 focus-visible:ring-purple-500 h-14 text-[15px] text-white rounded-2xl transition-all placeholder:text-zinc-600 shadow-inner" />
                      </div>
                      <div className="pt-4">
                        <Button type="submit" className="w-full bg-white hover:bg-zinc-200 text-black font-bold h-14 rounded-2xl text-[15px] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:translate-y-0 duration-200">Access Workspace</Button>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="register" className="mt-0 outline-none animate-in slide-in-from-right-4 fade-in duration-300">
                    <form className="space-y-5" onSubmit={handleAuth}>
                      <div className="space-y-2 group">
                        <Label className="text-zinc-400 px-1 text-[11px] uppercase tracking-wider font-bold group-focus-within:text-pink-400 transition-colors">Username</Label>
                        <Input type="text" placeholder="e.g. creative" value={username} onChange={e => setUsername(e.target.value)} required className="pl-4 bg-black/40 border-white/5 focus-visible:border-pink-500 focus-visible:ring-1 focus-visible:ring-pink-500 h-14 text-[15px] text-white rounded-2xl transition-all placeholder:text-zinc-600 shadow-inner" />
                      </div>
                      <div className="space-y-2 group">
                        <Label className="text-zinc-400 px-1 text-[11px] uppercase tracking-wider font-bold group-focus-within:text-pink-400 transition-colors">Email Address</Label>
                        <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="pl-4 bg-black/40 border-white/5 focus-visible:border-pink-500 focus-visible:ring-1 focus-visible:ring-pink-500 h-14 text-[15px] text-white rounded-2xl transition-all placeholder:text-zinc-600 shadow-inner" />
                      </div>
                      <div className="space-y-2 group">
                        <Label className="text-zinc-400 px-1 text-[11px] uppercase tracking-wider font-bold group-focus-within:text-pink-400 transition-colors">Secure Password</Label>
                        <Input type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required className="pl-4 bg-black/40 border-white/5 focus-visible:border-pink-500 focus-visible:ring-1 focus-visible:ring-pink-500 h-14 text-[15px] text-white rounded-2xl transition-all placeholder:text-zinc-600 shadow-inner" />
                      </div>
                      <div className="pt-4">
                        <Button type="submit" className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white font-bold h-14 rounded-2xl text-[15px] shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">Create Account</Button>
                      </div>
                    </form>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Extract all media attachments from current channel messages
  const allImages = messages.flatMap(m => m.attachments || []).filter(a => a.file_type && a.file_type.startsWith('image/'));
  const allFiles = messages.flatMap(m => m.attachments || []).filter(a => !(a.file_type && a.file_type.startsWith('image/')));

  // Determine active profile for right sidebar
  const rightProfileName = activeChannel?.is_saved ? 'ME' : (activeChannel?.name || 'User');

  let isOnline = false;
  let rightProfileStatus = 'Collaborative Space';
  if (activeChannel?.is_saved) {
    isOnline = true;
    rightProfileStatus = 'Just You';
  } else if (activeChannel?.is_dm) {
    isOnline = !!(activeChannel.is_online || activeChannel.last_seen?.includes('second') || activeChannel.last_seen?.includes('just') || activeChannel.last_seen === 'Online');
    rightProfileStatus = isOnline ? 'Active Now' : `Last seen ${activeChannel.last_seen || 'recently'}`;
  }

  const rightProfileAvatar = activeChannel?.is_saved ? (user?.avatar ? `http://localhost:8000${user.avatar}` : null) : (activeChannel?.avatar ? `http://localhost:8000${activeChannel.avatar}` : null);

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="bg-wallpaper"></div>

      <div className="app-container">
        {/* Nav Sidebar */}
        <div className="nav-sidebar">
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Avatar className="w-10 h-10 mb-8 border border-white/10 shadow-lg cursor-pointer hover:opacity-80 transition-opacity" onClick={openSettings}>
                <AvatarImage src={user.avatar ? `http://localhost:8000${user.avatar}` : null} className="object-cover" />
                <AvatarFallback className="bg-zinc-800 font-bold hover:bg-zinc-700 text-white">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </DialogTrigger>
            <DialogContent className="bg-[#16161a] border-white/10 text-white sm:max-w-[460px] rounded-2xl shadow-2xl overflow-hidden p-0 gap-0 focus:outline-none">
              <div className="relative h-28 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-90 shadow-inner" />
              <div className="px-8 pb-8 relative -mt-12 flex flex-col items-center">
                <DialogHeader className="mb-6 flex flex-col items-center w-full text-center">
                  <div className="w-24 h-24 rounded-full border-4 border-[#16161a] bg-zinc-900 overflow-hidden shadow-2xl mb-4 flex items-center justify-center relative group text-zinc-400 hover:text-white transition-colors">
                    {profileAvatar ? <img src={URL.createObjectURL(profileAvatar)} className="w-full h-full object-cover" /> : user?.avatar ? <img src={`http://localhost:8000${user.avatar}`} className="w-full h-full object-cover" /> : <User className="w-10 h-10" />}
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 backdrop-blur-sm transition-all duration-300">
                      <CloudUpload className="w-6 h-6 mb-1 text-white animate-bounce" />
                      <span className="text-[10px] font-bold text-white tracking-widest">UPLOAD</span>
                    </div>
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={e => setProfileAvatar(e.target.files[0])} />
                  </div>
                  <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-1">Profile Settings</DialogTitle>
                  <DialogDescription className="text-zinc-500 text-sm">Personalize how others see you in the workspace.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveProfile} className="space-y-6 w-full">
                  <div className="space-y-2 focus-within:text-purple-400 text-zinc-400 transition-colors">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-inherit flex items-center gap-2"><User className="w-3.5 h-3.5" /> Display Name</Label>
                    <Input value={profileName} onChange={e => setProfileName(e.target.value)} className="bg-[#1e1e24] border-white/5 text-white h-12 px-4 rounded-xl focus-visible:ring-1 focus-visible:ring-purple-500 focus-visible:border-purple-500 transition-all font-medium placeholder:text-zinc-600" placeholder="Your name" />
                  </div>
                  <div className="space-y-2 focus-within:text-pink-400 text-zinc-400 transition-colors">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-inherit flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> Status Message</Label>
                    <Input value={profileStatus} onChange={e => setProfileStatus(e.target.value)} className="bg-[#1e1e24] border-white/5 text-white h-12 px-4 rounded-xl focus-visible:ring-1 focus-visible:ring-pink-500 focus-visible:border-pink-500 transition-all text-sm placeholder:text-zinc-600" placeholder="What's on your mind?" />
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:via-purple-400 hover:to-pink-400 text-white font-bold h-12 rounded-xl border-none shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] mt-4 flex items-center justify-center gap-2 group">
                    <Sparkles className="w-4 h-4 group-hover:animate-pulse" /> Save Changes
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex-1 flex flex-col gap-2 w-full px-2">
            <div className="nav-item"><LayoutTemplate className="w-5 h-5" /></div>
            <div className="nav-item active text-white bg-white/5 rounded-[14px] shadow-sm"><MessageSquare className="w-5 h-5" /></div>
            <div className="nav-item"><CheckCircle className="w-5 h-5" /></div>
            <div className="nav-item"><Star className="w-5 h-5" /></div>
            <div className="nav-item"><Tag className="w-5 h-5" /></div>
          </div>

          <div className="nav-item mt-auto"><CloudUpload className="w-5 h-5" /></div>
          <div className="nav-item text-red-400 hover:text-red-300" onClick={handleLogout} title="Logout"><LogOut className="w-5 h-5" /></div>
        </div>

        {/* Inbox Sidebar */}
        <div className="inbox-sidebar">
          <div className="inbox-search">
            <div className="search-input-wrap relative w-full">
              <Search className="search-icon" />
              <input type="text" className="search-input" placeholder="Search users..." value={searchQuery} onChange={e => handleSearchUsers(e.target.value)} />

              {searchQuery.length >= 2 && (
                <div className="absolute top-12 flex flex-col left-0 right-0 bg-[#16161e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <ScrollArea className="max-h-[250px] flex-1">
                    {isSearchingUsers ? (
                      <div className="p-4 text-center text-zinc-400 text-sm">Searching...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-4 text-center text-zinc-400 text-sm">No users found</div>
                    ) : (
                      searchResults.map(u => (
                        <div key={u.id} className="p-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors border-b border-white/5 last:border-0" onClick={() => startDM(u.id)}>
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-zinc-700 text-xs text-white uppercase">{u.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 overflow-hidden">
                            <div className="font-medium text-white text-[13px] truncate">{u.name}</div>
                            {u.status_message && <div className="text-[11px] text-zinc-500 truncate">{u.status_message}</div>}
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 px-2 pb-4">
            <div className="space-y-1">
              {channels.filter(c => c.name.toLowerCase() !== 'general').map(c => {
                const isActive = activeChannel?.id === c.id;
                const dateRaw = c.last_message?.created_at || c.created_at;

                let timeString = '';
                if (dateRaw) {
                  const d = new Date(dateRaw);
                  if (!isNaN(d.getTime())) {
                    timeString = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  }
                }

                return (
                  <div key={c.id} className={`chat-item ${isActive ? 'active' : ''}`} onClick={() => handleChannelClick(c)}>
                    <div className="chat-item-avatar">
                      {c.is_saved ? (
                        <Avatar className="w-full h-full">
                          <AvatarImage src={user?.avatar ? `http://localhost:8000${user.avatar}` : null} className="object-cover" />
                          <AvatarFallback className="bg-zinc-700 font-bold text-white">ME</AvatarFallback>
                        </Avatar>
                      ) : (
                        <Avatar className="w-full h-full">
                          <AvatarImage src={c.avatar ? `http://localhost:8000${c.avatar}` : null} className="object-cover" />
                          <AvatarFallback className="bg-zinc-700 font-bold text-white">
                            {c.is_group ? <Hash className="w-4 h-4 text-purple-400" /> : c.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {(c.is_dm || c.is_saved) && (c.is_online || c.last_seen?.includes('second') || c.last_seen?.includes('just') || c.is_saved) && <div className="status-dot status-online"></div>}
                    </div>
                    <div className="chat-item-content">
                      <div className="chat-item-header">
                        <span className="chat-item-name">{c.is_saved ? 'ME' : c.name}</span>
                        <span className="chat-item-time">{timeString}</span>
                      </div>
                      <div className="chat-item-msg">
                        {c.last_message?.content ? (
                          c.last_message.content.includes('![Sticker]') ? 'Sent a Sticker' :
                            c.last_message.content.includes('![GIF]') ? 'Sent a GIF' :
                              c.last_message.content
                        ) : (c.is_saved ? 'Personal drafts space.' : 'Start chatting now.')}
                      </div>
                    </div>
                    {(!isActive && c.unread_count > 0) && <div className="unread-badge">{c.unread_count > 99 ? '99+' : c.unread_count}</div>}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Main Content Area */}
        {!activeChannel ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#16161e]/80 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-10 w-full relative overflow-hidden backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none"></div>
            <div className="w-32 h-32 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-[0_0_50px_rgba(168,85,247,0.3)] mb-8 animate-pulse">
              <MessageSquare className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 mb-4 text-center">Your Interconnected Space</h2>
            <p className="text-zinc-500 text-[16px] max-w-md text-center">Select a conversation from the sidebar or search for a user to start networking instantly.</p>
          </div>
        ) : (
          <>
            {/* Chat Area */}
            <div className="chat-area shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-10">
              <div className="chat-header border-b border-white/[0.05]">
                <div className="header-user-info">
                  {(activeChannel?.is_dm || activeChannel?.is_saved) && (
                    <Avatar
                      className="w-10 h-10 shadow-md cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setShowRightSidebar(!showRightSidebar)}
                    >
                      <AvatarImage src={(activeChannel?.is_saved ? user?.avatar : activeChannel.avatar) ? `http://localhost:8000${activeChannel?.is_saved ? user?.avatar : activeChannel.avatar}` : null} className="object-cover" />
                      <AvatarFallback className="bg-zinc-700 font-bold text-white">{activeChannel?.is_saved ? 'ME' : activeChannel.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="header-user-text">
                    <div
                      className="header-name cursor-pointer hover:text-zinc-200 transition-colors"
                      onClick={() => setShowRightSidebar(!showRightSidebar)}
                    >
                      {activeChannel?.is_saved ? 'ME' : (activeChannel?.name || 'Channel')}
                      {(activeChannel?.is_dm || activeChannel?.is_saved) && isOnline && <span className="status-dot-inline"></span>}
                    </div>
                    {(activeChannel?.is_dm || activeChannel?.is_saved) && <div className="header-status">{rightProfileStatus}</div>}

                    {/* Typing Indicator in Header */}
                    {typingUsers[activeChannel?.id] && Object.keys(typingUsers[activeChannel.id]).length > 0 && (
                      <div className="text-xs text-purple-400 font-medium italic mt-0.5 animate-pulse">
                        {Object.values(typingUsers[activeChannel.id]).join(', ')} is typing...
                      </div>
                    )}
                  </div>
                </div>
                <div className="header-actions">
                  <User className="w-5 h-5 cursor-pointer hover:text-white transition-colors" onClick={() => setShowRightSidebar(!showRightSidebar)} />
                </div>
              </div>

              <div className="messages-list">
                {isLoading ? (
                  <div className="m-auto flex flex-col items-center opacity-30 animate-pulse">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="m-auto flex flex-col items-center text-zinc-500 text-center max-w-sm">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6"><MessageSquare className="w-8 h-8 opacity-50" /></div>
                    <h3 className="text-xl font-bold text-white/80 mb-2">No messages yet</h3>
                    <p className="text-sm">Say hello and start the conversation.</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isOwn = msg.user?.id === user.id;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

                    const isConsecutivePrev = prevMsg && prevMsg.user?.id === msg.user?.id;

                    return (
                      <div className={`msg-row ${isOwn ? 'own' : 'other'} ${isConsecutivePrev ? 'mt-[-10px]' : ''}`} key={msg.id}>
                        {!isOwn && (
                          <div className="msg-avatar">
                            {!nextMsg || nextMsg.user?.id !== msg.user?.id ? (
                              <Avatar className="w-full h-full rounded-full shadow-md">
                                <AvatarImage src={msg.user?.avatar ? `http://localhost:8000${msg.user?.avatar}` : null} className="object-cover" />
                                <AvatarFallback className="bg-zinc-700 font-bold text-xs">{msg.user?.name.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                            ) : <div className="w-full h-full"></div>}
                          </div>
                        )}

                        <div className={`msg-content-wrapper flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                          <div className="msg-bubble">
                            <div className="prose-chat text-white">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ node, ...props }) => <span {...props} />,
                                  a: ({ node, ...props }) => <a className="text-blue-400 hover:underline" {...props} />,
                                  strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                                  em: ({ node, ...props }) => <em className="italic" {...props} />,
                                  code: ({ node, inline, ...props }) => inline ? <code className="bg-black/30 rounded px-1.5 py-0.5 font-mono text-sm" {...props} /> : <pre className="bg-black/30 p-2 rounded-md my-2 overflow-x-auto"><code className="font-mono text-sm" {...props} /></pre>,
                                  img: ({ node, ...props }) => <img className="max-w-[200px] max-h-[200px] rounded-lg inline-block my-1" {...props} />
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>

                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-3 overflow-hidden rounded-[8px]">
                                {msg.attachments.map(att => (
                                  att.file_type.startsWith('image/') ?
                                    <img key={att.id} src={`http://localhost:8000${att.file_path}`} className="max-w-xs max-h-[200px] object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity" alt="attachment" onClick={() => setSelectedImage(`http://localhost:8000${att.file_path}`)} />
                                    :
                                    <a key={att.id} href={`http://localhost:8000${att.file_path}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-black/20 p-2 rounded-md hover:bg-black/30 text-sm">
                                      <Paperclip className="w-4 h-4" /> {att.file_path.split('/').pop()}
                                    </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="msg-time flex flex-row items-center gap-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isOwn && (
                              msg.read_by && msg.read_by.length > 0 ? <CheckCheck className="w-3 h-3 text-blue-400" /> : (msg.delivered_to && msg.delivered_to.length > 0 ? <CheckCheck className="w-3 h-3 text-zinc-400" /> : <Check className="w-3 h-3 text-zinc-400" />)
                            )}
                          </span>
                        </div>

                        {isOwn && (
                          <div className="msg-avatar" style={{ marginRight: 0, marginLeft: 15 }}>
                            {!nextMsg || nextMsg.user?.id !== msg.user?.id ? (
                              <Avatar className="w-full h-full rounded-full shadow-md">
                                <AvatarImage src={user.avatar ? `http://localhost:8000${user.avatar}` : null} className="object-cover" />
                                <AvatarFallback className="bg-zinc-700 font-bold text-xs">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                            ) : <div className="w-full h-full"></div>}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} className="h-2" />
              </div>

              <div className="chat-input-area">
                {file && (
                  <div className="flex items-center justify-between px-3 py-2 bg-white/10 rounded-t-lg text-sm text-white border border-white/10 border-b-0">
                    <span className="flex items-center gap-2"><Paperclip className="w-4 h-4" /> {file.name}</span>
                    <X className="w-4 h-4 cursor-pointer hover:text-red-400" onClick={() => setFile(null)} />
                  </div>
                )}
                <form className={`chat-input-wrap ${file ? 'rounded-tl-none rounded-tr-none' : ''}`} onSubmit={sendMessage}>
                  <input type="file" id="fileInput" className="hidden" onChange={e => setFile(e.target.files[0])} />

                  <Popover>
                    <PopoverTrigger asChild>
                      <Smile className="w-5 h-5 ml-4 cursor-pointer text-zinc-400 hover:text-white transition-colors shrink-0" />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-white/5 bg-[#16161e] mb-2 shadow-2xl" side="top" align="start">
                      <EmojiPicker theme="dark" onEmojiClick={(e) => setMsgContent(prev => prev + e.emoji)} />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <ImageIcon className="w-5 h-5 ml-2 cursor-pointer text-zinc-400 hover:text-white transition-colors shrink-0" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-2 border-white/5 bg-[#16161e] mb-2 shadow-2xl" side="top" align="start">
                      <input type="text" placeholder="Search GIFs..." value={gifSearch} onChange={e => setGifSearch(e.target.value)} className="w-full bg-[#1e1e24] border-white/5 focus:border-purple-500 rounded-lg h-9 px-3 text-sm text-white mb-2 font-medium placeholder:text-zinc-600" />
                      <ScrollArea className="h-[250px] w-full pr-3">
                        <div className="grid grid-cols-2 gap-2">
                          {gifResults.map(g => (
                            <img key={g.id} src={g.media[0].tinygif.url} className="w-full h-[100px] object-cover rounded-md cursor-pointer hover:opacity-80 transition-all" onClick={() => { sendMessage(null, ` ![GIF](${g.media[0].tinygif.url}) `); document.dispatchEvent(new KeyboardEvent('keydown', { 'key': 'Escape' })); }} />
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Gift className="w-5 h-5 mx-2 cursor-pointer text-zinc-400 hover:text-white transition-colors shrink-0" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-3 border-white/5 bg-[#16161e] mb-2 shadow-2xl" side="top" align="start">
                      <div className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-wider">Stickers</div>
                      <div className="grid grid-cols-3 gap-3">
                        {STICKERS.map((s, i) => (
                          <img key={i} src={s} className="w-full aspect-square object-contain bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 p-2 transition-all hover:scale-105" onClick={() => { sendMessage(null, ` ![Sticker](${s}) `); document.dispatchEvent(new KeyboardEvent('keydown', { 'key': 'Escape' })); }} />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <input
                    type="text"
                    className="flex-1 bg-transparent border-none text-white focus:outline-none placeholder:text-zinc-500 min-w-0"
                    placeholder="Type a message... (Use **bold**, *italic*, `code`)"
                    value={msgContent}
                    onChange={e => handleTyping(e.target.value)}
                  />
                  <Sparkles className="send-btn w-5 h-5 mx-2 text-purple-400 hover:text-purple-300 shrink-0" onClick={() => setShowAiDialog(true)} />
                  <Paperclip className="send-btn w-5 h-5 mr-3 shrink-0" onClick={() => document.getElementById('fileInput').click()} />
                  <button type="submit" className="bg-transparent border-none p-0 focus:outline-none shrink-0" disabled={!msgContent.trim() && !file}>
                    <Send className={`w-5 h-5 ${(!msgContent.trim() && !file) ? 'opacity-30' : 'text-white'}`} />
                  </button>
                </form>
              </div>
            </div>

            {/* Right Sidebar */}
            {showRightSidebar && (
              <div className="right-sidebar shadow-[-10px_0_30px_rgba(0,0,0,0.3)] z-20 relative animate-in slide-in-from-right-8 duration-300">
                <div className="absolute top-4 right-4 flex">
                  <span className="cursor-pointer hover:text-red-400 transition-colors text-[16px] text-zinc-500 font-bold" onClick={() => setShowRightSidebar(false)}>X</span>
                </div>

                <div className="profile-avatar-large mt-4 bg-zinc-800 flex items-center justify-center overflow-hidden">
                  {rightProfileAvatar ? (
                    <img src={rightProfileAvatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : activeChannel?.is_saved ? (
                    <Bookmark className="w-10 h-10 text-cyan-400 absolute z-[2]" />
                  ) : activeChannel?.is_group ? (
                    <Hash className="w-10 h-10 text-purple-400 absolute z-[2]" />
                  ) : (
                    <span className="text-3xl font-bold text-white absolute z-[2]">{rightProfileName.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <h3 className="profile-name truncate max-w-full px-4 text-center">{rightProfileName}</h3>
                <span className={`profile-status ${isOnline ? 'text-cyan-400' : 'text-zinc-500'}`}>{rightProfileStatus}</span>

                <Tabs defaultValue="images" className="flex-1 w-full mt-2 mx-[-10px] px-[10px] flex flex-col min-h-0">
                  <TabsList className="grid w-full grid-cols-2 bg-black/20 text-zinc-400 mb-2 rounded-xl h-10 border border-white/5">
                    <TabsTrigger value="images" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-lg">Images ({allImages.length})</TabsTrigger>
                    <TabsTrigger value="files" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white rounded-lg">Files ({allFiles.length})</TabsTrigger>
                  </TabsList>

                  <ScrollArea className="flex-1 w-full mx-[-10px] px-[10px] overflow-auto">
                    <TabsContent value="images" className="m-0 focus:outline-none pt-2">
                      <div className="attachment-grid pb-10">
                        {allImages.map(att => (
                          <img key={att.id} src={`http://localhost:8000${att.file_path}`} alt="att" onClick={() => setSelectedImage(`http://localhost:8000${att.file_path}`)} className="cursor-pointer hover:opacity-80 transition-opacity" />
                        ))}
                        {allImages.length === 0 && (
                          <div className="col-span-3 text-center text-xs text-zinc-500 py-10">No images yet.</div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="files" className="m-0 focus:outline-none pt-2">
                      <div className="flex flex-col gap-2 pb-10 w-full">
                        {allFiles.map(att => (
                          <a key={att.id} href={`http://localhost:8000${att.file_path}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 p-3 rounded-lg transition-colors text-sm text-zinc-300 w-full overflow-hidden border border-white/5">
                            <Paperclip className="w-4 h-4 text-pink-400 shrink-0" />
                            <span className="truncate">{att.file_path.split('/').pop()}</span>
                          </a>
                        ))}
                        {allFiles.length === 0 && (
                          <div className="text-center text-xs text-zinc-500 py-10">No files yet.</div>
                        )}
                      </div>
                    </TabsContent>
                  </ScrollArea>
                </Tabs>
              </div>
            )}
          </>
        )}

      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity" onClick={() => setSelectedImage(null)}>
          <div className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full cursor-pointer text-white transition-all">
            <X className="w-8 h-8" />
          </div>
          <img src={selectedImage} alt="Fullscreen Attachment" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="bg-[#16161a] border-white/10 text-white sm:max-w-[500px] rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" /> AI Message Assistant
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Describe what you want to say, and the AI will draft a professional message for you to review before sending.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAiGenerate} className="space-y-4 mt-4">
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g., Ask the team for an update on the Q3 marketing report..."
              className="w-full bg-[#1e1e24] border border-white/5 rounded-xl text-white p-4 h-32 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
              required
            />
            <Button type="submit" disabled={isGenerating || !aiPrompt.trim()} className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 text-white font-bold h-12 rounded-xl border-none">
              {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Drafting Message...</> : 'Draft Message'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default App;
