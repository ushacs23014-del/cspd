/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  LayoutDashboard, 
  Search, 
  History, 
  AlertTriangle, 
  User as UserIcon,
  LogOut,
  BarChart3,
  MessageSquareWarning,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Upload,
  FileText,
  Layers,
  Bell,
  CheckCircle2,
  XCircle,
  Download,
  Filter,
  Settings as SettingsIcon,
  Trash2,
  Lock,
  Mail,
  ToggleLeft,
  ToggleRight,
  Globe,
  Phone,
  Link,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip 
} from 'recharts';
import Papa from 'papaparse';
import { User, DetectionResult, Stats, AuditLog } from './types';
import { Language, translations } from './i18n';

// --- i18n Context ---
const LanguageContext = React.createContext<{
  language: Language;
  setLanguage: (l: Language) => void;
  t: (path: string) => string;
}>({
  language: 'en',
  setLanguage: () => {},
  t: (path: string) => path
});

const useI18n = () => React.useContext(LanguageContext);

// --- Components ---

const Navbar = ({ user, onLogout, activeTab, setActiveTab, onRequestVerification }: { 
  user: User & { email_verified?: number } | null, 
  onLogout: () => void, 
  activeTab: string, 
  setActiveTab: (t: string) => void,
  onRequestVerification: () => void
}) => {
  const { t, language, setLanguage } = useI18n();
  const navItems = [
    { id: 'detect', label: t('nav.detection'), icon: Search, roles: ['Admin', 'User'] },
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, roles: ['Admin', 'Analyst'] },
    { id: 'history', label: t('nav.history'), icon: History, roles: ['Admin', 'Analyst'] },
    { id: 'notifications', label: t('nav.notifications'), icon: Bell, roles: ['Admin'] },
    { id: 'audit', label: t('nav.audit'), icon: ClipboardList, roles: ['Admin'] },
    { id: 'complaints', label: t('nav.complaints'), icon: MessageSquareWarning, roles: ['Admin', 'User'] },
    { id: 'settings', label: t('nav.settings'), icon: SettingsIcon, roles: ['Admin', 'User', 'Analyst'] },
  ];

  const filteredItems = navItems.filter(item => user && item.roles.includes(user.role));

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-cyber-gray border-r border-white/10 p-6 flex flex-col gap-8 z-50">
      <div className="flex items-center gap-3 px-2">
        <div className="w-10 h-10 bg-cyber-accent rounded-lg flex items-center justify-center">
          <ShieldAlert className="text-black" size={24} />
        </div>
        <h1 className="font-bold text-xl tracking-tight">CyberGuard</h1>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === item.id 
                ? 'bg-cyber-accent/10 text-cyber-accent' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {user && (
        <div className="mt-auto flex flex-col gap-4">
          {!user.email_verified && (
            <div className="px-4 py-3 bg-cyber-warning/10 border border-cyber-warning/20 rounded-xl">
              <p className="text-[10px] font-bold text-cyber-warning uppercase mb-2 flex items-center gap-1">
                <AlertTriangle size={10} /> {t('auth.unverified')}
              </p>
              <button 
                onClick={onRequestVerification}
                className="text-[10px] text-white hover:underline font-bold"
              >
                {t('auth.requestVerification')}
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-cyber-accent/20 flex items-center justify-center relative">
              <UserIcon size={16} className="text-cyber-accent" />
              <span className="absolute -top-1 -right-1 px-1 bg-cyber-accent text-black text-[8px] font-bold rounded">
                {user.role[0]}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate">{user.name}</p>
              <div className="flex items-center gap-1">
                <p className="text-xs text-white/40 truncate">{user.role}</p>
                {user.email_verified ? (
                  <ShieldCheck size={10} className="text-cyber-accent" />
                ) : null}
              </div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 text-cyber-danger hover:bg-cyber-danger/10 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">{t('nav.logout')}</span>
          </button>
        </div>
      )}
    </nav>
  );
};

const DetectionView = ({ user }: { user: User | null }) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [message, setMessage] = useState('');
  const [batchMessages, setBatchMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 5;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDetect = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      console.log("[Detection] Starting scan for message:", message.substring(0, 50) + "...");
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      
      const text = await res.text();
      console.log("[Detection] Raw response:", text);
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = { error: "Invalid response from server" };
      }

      if (res.ok) {
        console.log("[Detection] Scan successful!");
        setResult(data);
      } else {
        console.error("[Detection] Scan failed with status:", res.status, data.error);
        setError(data.error || "Failed to analyze message");
      }
    } catch (e) {
      console.error("[Detection] Request failed:", e);
      setError("Connection failed. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDetect = async (messagesToProcess: string[]) => {
    if (messagesToProcess.length === 0) return;
    setLoading(true);
    setError(null);
    setBatchResults([]);
    try {
      const res = await fetch('/api/detect/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesToProcess })
      });
      
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : [];
      } catch (e) {
        data = { error: "Invalid response from server" };
      }

      if (res.ok) {
        setBatchResults(data);
        setCurrentPage(1);
      } else {
        setError(data.error || "Batch detection failed");
      }
    } catch (e) {
      console.error(e);
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (results) => {
        const messages = results.data
          .flat()
          .map((m: any) => String(m).trim())
          .filter(m => m.length > 0);
        setBatchMessages(messages);
        setMessage(messages.join('\n'));
      },
      header: false,
      skipEmptyLines: true
    });
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);
    if (mode === 'batch') {
      const lines = val.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      setBatchMessages(lines);
    }
  };

  // Pagination logic
  const indexOfLastResult = currentPage * resultsPerPage;
  const indexOfFirstResult = indexOfLastResult - resultsPerPage;
  const currentResults = batchResults.slice(indexOfFirstResult, indexOfLastResult);
  const totalPages = Math.ceil(batchResults.length / resultsPerPage);

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-4xl font-bold mb-4">{t('detect.title')}</h2>
        <p className="text-white/60">{t('detect.subtitle')}</p>
      </motion.div>

      <div className="flex gap-4 mb-8">
        <button
          onClick={() => { setMode('single'); setResult(null); setBatchResults([]); }}
          className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${
            mode === 'single' ? 'bg-cyber-accent text-black' : 'bg-white/5 text-white/40 hover:text-white'
          }`}
        >
          <FileText size={18} />
          Single Message
        </button>
        <button
          onClick={() => { setMode('batch'); setResult(null); setBatchResults([]); }}
          className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl font-bold transition-all ${
            mode === 'batch' ? 'bg-cyber-accent text-black' : 'bg-white/5 text-white/40 hover:text-white'
          }`}
        >
          <Layers size={18} />
          Batch Detection
        </button>
      </div>

      <div className="glass-panel p-8 mb-8">
        <div className="flex justify-between items-center mb-4">
          <label className="text-xs font-bold text-white/40 uppercase tracking-widest">
            {mode === 'single' ? 'Message Content' : 'Messages (One per line)'}
          </label>
          {mode === 'batch' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-xs font-bold text-cyber-accent hover:underline"
            >
              <Upload size={14} />
              Upload CSV
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.txt"
            className="hidden"
          />
        </div>
        <textarea
          value={message}
          onChange={handleTextareaChange}
          placeholder={t('detect.placeholder')}
          className="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-6 text-lg focus:outline-none focus:border-cyber-accent transition-all resize-none mb-6"
        />
        <div className="flex gap-4">
          <button
            onClick={() => mode === 'single' ? handleDetect() : handleBatchDetect(batchMessages)}
            disabled={loading || !message.trim()}
            className="flex-1 cyber-button cyber-button-primary flex items-center justify-center gap-2 h-14 text-lg disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Search size={24} />}
            {loading ? t('detect.scanning') : t('detect.button')}
          </button>
          {(message || result) && (
            <button
              onClick={() => { setMessage(''); setResult(null); setError(null); }}
              className="px-6 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-xl font-bold transition-all"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8 p-4 bg-cyber-danger/10 border border-cyber-danger/20 rounded-xl text-cyber-danger flex items-center gap-3"
          >
            <AlertTriangle size={20} />
            <p className="font-bold">{error}</p>
          </motion.div>
        )}

        {mode === 'single' && result && (
          <motion.div
            key="single-result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`glass-panel overflow-hidden border-2 ${
              result.verdict === 'Scam' ? 'border-cyber-danger/50' : 'border-cyber-accent/50'
            }`}
          >
            <div className={`p-3 text-center font-black uppercase tracking-[0.3em] text-[10px] ${
              result.verdict === 'Scam' ? 'bg-cyber-danger text-white' : 'bg-cyber-accent text-black'
            }`}>
              {result.verdict === 'Scam' ? 'Security Alert: Scam Detected' : 'Security Scan: Likely Safe'}
            </div>
            <div className="p-8">
              <div className="flex flex-col gap-8">
                <div className="flex items-start gap-6">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${
                    result.verdict === 'Scam' ? 'bg-cyber-danger/20 text-cyber-danger' : 'bg-cyber-accent/20 text-cyber-accent'
                  }`}>
                    {result.verdict === 'Scam' ? <ShieldAlert size={32} /> : <ShieldCheck size={32} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex flex-col">
                        <h3 className={`text-3xl font-black uppercase tracking-tight ${
                          result.verdict === 'Scam' ? 'text-cyber-danger' : 'text-cyber-accent'
                        }`}>
                          {result.verdict === 'Scam' ? t('detect.scamDetected') : t('detect.likelySafe')}
                        </h3>
                        {result.category && (
                          <span className="text-xs font-bold text-white/40 uppercase tracking-widest mt-1">
                            {t('detect.category')}: {result.category}
                          </span>
                        )}
                        {result.fallback_used && (
                          <span className="text-[10px] font-bold text-cyber-warning uppercase tracking-widest mt-1 flex items-center gap-1">
                            <AlertTriangle size={10} />
                            {t('detect.fallback')}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-4 py-2 rounded-lg text-sm font-black uppercase tracking-wider shadow-lg ${
                          result.riskLevel === 'High' ? 'bg-cyber-danger text-white shadow-cyber-danger/20' : 
                          result.riskLevel === 'Medium' ? 'bg-cyber-warning text-black shadow-cyber-warning/20' : 'bg-cyber-accent text-black shadow-cyber-accent/20'
                        }`}>
                          {result.riskLevel} Risk
                        </span>
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                          Confidence: {(result.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 mb-4">
                      <p className="text-white/90 leading-relaxed italic">"{result.analysis}"</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-white/40">
                      <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${
                            result.verdict === 'Scam' ? 'bg-cyber-danger' : 'bg-cyber-accent'
                          }`}
                          style={{ width: `${result.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {result.verdict === 'Scam' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/10">
                  <div className="space-y-6">
                    {result.suspicious_phrases && result.suspicious_phrases.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">{t('detect.phrases')}</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.suspicious_phrases.map((phrase, i) => (
                            <span key={i} className="px-2 py-1 bg-cyber-danger/10 text-cyber-danger text-[10px] font-bold rounded border border-cyber-danger/20">
                              "{phrase}"
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {result.reasons && result.reasons.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">{t('detect.reasons')}</h4>
                        <ul className="space-y-2">
                          {result.reasons.map((reason, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                              <div className="w-1 h-1 bg-cyber-danger rounded-full mt-2 shrink-0" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {result.recommended_actions && result.recommended_actions.length > 0 && (
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                      <h4 className="text-xs font-bold text-cyber-accent uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ShieldCheck size={14} />
                        {t('detect.actions')}
                      </h4>
                      <ul className="space-y-3">
                        {result.recommended_actions.map((action, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-white/90">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyber-accent/20 text-cyber-accent text-[10px] font-bold shrink-0">
                              {i + 1}
                            </span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {result.threat_intel && result.threat_intel.length > 0 && (
                <div className="pt-8 border-t border-white/10">
                  <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Layers size={14} />
                    {t('detect.threatIntel')}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {result.threat_intel.map((intel, i) => (
                      <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          intel.reputation === 'malicious' ? 'bg-cyber-danger/20 text-cyber-danger' :
                          intel.reputation === 'suspicious' ? 'bg-cyber-warning/20 text-cyber-warning' : 'bg-cyber-accent/20 text-cyber-accent'
                        }`}>
                          {intel.type === 'url' && <Link size={18} />}
                          {intel.type === 'email' && <Mail size={18} />}
                          {intel.type === 'phone' && <Phone size={18} />}
                          {intel.type === 'domain' && <Globe size={18} />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-white/40 uppercase">{intel.type}</span>
                            <span className={`text-[10px] font-bold uppercase ${
                              intel.reputation === 'malicious' ? 'text-cyber-danger' :
                              intel.reputation === 'suspicious' ? 'text-cyber-warning' : 'text-cyber-accent'
                            }`}>
                              {t(`detect.${intel.reputation}`)}
                            </span>
                          </div>
                          <p className="text-sm font-mono truncate text-white/90 mb-1">{intel.value}</p>
                          <p className="text-[10px] text-white/40 leading-tight">{intel.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

        {mode === 'batch' && batchResults.length > 0 && (
          <motion.div
            key="batch-results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-panel overflow-hidden"
          >
            <div className="p-6 bg-white/5 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-lg">Batch Results ({batchResults.length})</h3>
              <div className="flex items-center gap-4">
                <span className="text-xs text-white/40">Page {currentPage} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                    <th className="p-6">Message</th>
                    <th className="p-6">Prediction</th>
                    <th className="p-6">Risk</th>
                    <th className="p-6">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {currentResults.map((res, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="p-6">
                        <p className="text-sm text-white/80 line-clamp-2 max-w-xs">{res.message}</p>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase w-fit ${
                            res.verdict === 'Scam' ? 'bg-cyber-danger/20 text-cyber-danger' : 'bg-cyber-accent/20 text-cyber-accent'
                          }`}>
                            {t(`detect.${res.verdict.toLowerCase()}`)}
                          </span>
                          {res.fallback_used && (
                            <span className="text-[9px] font-bold text-cyber-warning uppercase flex items-center gap-1">
                              <AlertTriangle size={8} />
                              {t('detect.fallback')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-6">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          res.riskLevel === 'High' ? 'bg-cyber-danger/20 text-cyber-danger' : 
                          res.riskLevel === 'Medium' ? 'bg-cyber-warning/20 text-cyber-warning' : 'bg-cyber-accent/20 text-cyber-accent'
                        }`}>
                          {t(`detect.${res.riskLevel.toLowerCase()}`)}
                        </span>
                      </td>
                      <td className="p-6">
                        <span className="text-sm font-mono text-white/60">
                          {(res.confidence * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ForgotPasswordView = ({ onBack }: { onBack: () => void }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setMessage(data.message);
    } catch (err) {
      setMessage('Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cyber-black">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md glass-panel p-10">
        <h2 className="text-3xl font-bold text-center mb-8">Forgot Password</h2>
        {message ? (
          <div className="text-center space-y-6">
            <p className="text-cyber-accent">{message}</p>
            <button onClick={onBack} className="cyber-button cyber-button-primary w-full">Back to Login</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 focus:border-cyber-accent focus:outline-none"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full cyber-button cyber-button-primary h-12">
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Send Reset Link'}
            </button>
            <button type="button" onClick={onBack} className="w-full text-white/40 hover:text-white text-sm">Cancel</button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

const ResetPasswordView = ({ token, onComplete }: { token: string, onComplete: () => void }) => {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Password reset successfully!');
        setTimeout(onComplete, 2000);
      } else {
        setMessage(data.error);
      }
    } catch (err) {
      setMessage('Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cyber-black">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md glass-panel p-10">
        <h2 className="text-3xl font-bold text-center mb-8">Reset Password</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-white/40 uppercase mb-2">New Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 focus:border-cyber-accent focus:outline-none"
            />
          </div>
          {message && <p className="text-center text-sm text-cyber-accent">{message}</p>}
          <button type="submit" disabled={loading} className="w-full cyber-button cyber-button-primary h-12">
            {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Update Password'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const VerifyEmailView = ({ token, onComplete }: { token: string, onComplete: () => void }) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          setMessage(data.message);
          setTimeout(onComplete, 2000);
        } else {
          setStatus('error');
          setMessage(data.error);
        }
      } catch (err) {
        setStatus('error');
        setMessage('Verification failed.');
      }
    };
    verify();
  }, [token, onComplete]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cyber-black">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md glass-panel p-10 text-center">
        <h2 className="text-3xl font-bold mb-8">Email Verification</h2>
        {status === 'loading' && <Loader2 className="animate-spin mx-auto text-cyber-accent" size={48} />}
        {status === 'success' && <div className="text-cyber-accent space-y-4"><ShieldCheck size={48} className="mx-auto" /><p>{message}</p></div>}
        {status === 'error' && <div className="text-cyber-danger space-y-4"><AlertTriangle size={48} className="mx-auto" /><p>{message}</p><button onClick={onComplete} className="cyber-button cyber-button-primary w-full">Go to App</button></div>}
      </motion.div>
    </div>
  );
};

const AuthView = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (view === 'forgot') return <ForgotPasswordView onBack={() => setView('login')} />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = view === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = view === 'login' ? { email, password } : { email, password, name };

    try {
      console.log(`[Auth] Attempting ${view} for ${email}...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const text = await res.text();
      console.log(`[Auth] ${view} response:`, text);
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = { error: "Invalid response from server" };
      }

      if (res.ok) {
        console.log(`[Auth] ${view} successful!`);
        onLogin(data);
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err) {
      console.error(`[Auth] ${view} failed:`, err);
      setError('Connection failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyber-accent/5 via-cyber-black to-cyber-black">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass-panel p-10"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-cyber-accent rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(0,255,65,0.3)]">
            <ShieldAlert className="text-black" size={32} />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-center mb-2">{view === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="text-white/40 text-center mb-8">{view === 'login' ? 'Secure your digital presence' : 'Join the CyberGuard network'}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {view === 'register' && (
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase mb-2">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 focus:border-cyber-accent focus:outline-none"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-white/40 uppercase mb-2">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 focus:border-cyber-accent focus:outline-none"
            />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label className="block text-xs font-bold text-white/40 uppercase">Password</label>
              {view === 'login' && (
                <button type="button" onClick={() => setView('forgot')} className="text-[10px] text-cyber-accent hover:underline font-bold uppercase">Forgot?</button>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 focus:border-cyber-accent focus:outline-none"
            />
          </div>
          {error && <p className="text-cyber-danger text-sm text-center">{error}</p>}
          <button type="submit" className="w-full cyber-button cyber-button-primary h-12 mt-4">
            {view === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-white/40">
          {view === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setView(view === 'login' ? 'register' : 'login')} className="text-cyber-accent font-bold hover:underline">
            {view === 'login' ? 'Sign Up' : 'Log In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

const DashboardView = ({ user }: { user: User | null }) => {
  const { t, language } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    riskLevel: '',
    prediction: ''
  });

  const fetchStats = () => {
    const params = new URLSearchParams(filters);
    fetch(`/api/stats?${params.toString()}`, {
      headers: { 'x-user-role': user?.role || '' }
    })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data) setStats(data);
    })
    .catch(err => console.error("Failed to fetch stats", err));
  };

  useEffect(() => {
    fetchStats();
  }, [user, filters]);

  const handleExport = () => {
    const params = new URLSearchParams(filters);
    window.open(`/api/detections/export?${params.toString()}`, '_blank');
  };

  if (!stats) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-cyber-accent" /></div>;

  const COLORS = ['#00ff41', '#f27d26', '#ff003c'];

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-4xl font-bold">{t('dashboard.title')}</h2>
        <button 
          onClick={handleExport}
          className="cyber-button cyber-button-primary flex items-center gap-2 px-6 h-12"
        >
          <Download size={18} />
          {t('dashboard.export')}
        </button>
      </div>

      <div className="glass-panel p-6 mb-12 flex flex-wrap gap-6 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">{t('dashboard.filters.start')}</label>
          <input 
            type="date" 
            value={filters.startDate}
            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-cyber-accent"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">{t('dashboard.filters.end')}</label>
          <input 
            type="date" 
            value={filters.endDate}
            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-cyber-accent"
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">{t('dashboard.filters.risk')}</label>
          <select 
            value={filters.riskLevel}
            onChange={(e) => setFilters({...filters, riskLevel: e.target.value})}
            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-cyber-accent"
          >
            <option value="">{t('dashboard.filters.allRisks')}</option>
            <option value="Low">{t('detect.low')}</option>
            <option value="Medium">{t('detect.medium')}</option>
            <option value="High">{t('detect.high')}</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">{t('dashboard.filters.prediction')}</label>
          <select 
            value={filters.prediction}
            onChange={(e) => setFilters({...filters, prediction: e.target.value})}
            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-cyber-accent"
          >
            <option value="">{t('dashboard.filters.allTypes')}</option>
            <option value="Scam">{t('detect.scam')}</option>
            <option value="Safe">{t('detect.safe')}</option>
          </select>
        </div>
        <button 
          onClick={() => setFilters({startDate: '', endDate: '', riskLevel: '', prediction: ''})}
          className="h-11 px-4 text-xs font-bold text-white/40 hover:text-white transition-all uppercase"
        >
          {t('dashboard.filters.reset')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="glass-panel p-8">
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-2">{t('dashboard.totalUsers')}</p>
          <p className="text-5xl font-bold">{stats.totalUsers}</p>
        </div>
        <div className="glass-panel p-8">
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-2">{t('dashboard.scamsBlocked')}</p>
          <p className="text-5xl font-bold text-cyber-danger">{stats.totalScams}</p>
        </div>
        <div className="glass-panel p-8">
          <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-2">{t('dashboard.systemStatus')}</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-cyber-accent rounded-full animate-pulse" />
            <p className="text-2xl font-bold text-cyber-accent uppercase">{t('dashboard.active')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-panel p-8">
          <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
            <BarChart3 size={20} className="text-cyber-accent" />
            {t('dashboard.riskDist')}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.riskDistribution}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {stats.riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#121212', border: '1px solid rgba(255,255,255,0.1)' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {stats.riskDistribution.map((entry, index) => (
              <div key={entry.riskLevel} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-xs text-white/60">{t(`detect.${entry.riskLevel.toLowerCase()}`)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-8">
          <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
            <History size={20} className="text-cyber-accent" />
            {t('dashboard.recentActivity')}
          </h3>
          <div className="space-y-4">
            {stats.recentDetections.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-medium truncate">{item.message_text}</p>
                  <p className="text-xs text-white/40">
                    {new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    }).format(new Date(item.timestamp))}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  item.verdict === 'Scam' ? 'bg-cyber-danger/20 text-cyber-danger' : 'bg-cyber-accent/20 text-cyber-accent'
                }`}>
                  {item.verdict}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ComplaintsView = ({ user }: { user: User | null }) => {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [allComplaints, setAllComplaints] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fetchComplaints = async () => {
    const res = await fetch('/api/complaints');
    const data = await res.json();
    setAllComplaints(data);
  };

  useEffect(() => {
    fetchComplaints();
  }, [user]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    setSubmitted(true);
    setText('');
    fetchComplaints();
    setTimeout(() => setSubmitted(false), 3000);
  };

  const handleUpdateStatus = async (id: number) => {
    await fetch(`/api/complaints/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: editStatus, reviewer_notes: editNotes })
    });
    setEditingId(null);
    fetchComplaints();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'text-cyber-accent bg-cyber-accent/10';
      case 'rejected': return 'text-cyber-danger bg-cyber-danger/10';
      case 'in-review': return 'text-cyber-warning bg-cyber-warning/10';
      default: return 'text-white/40 bg-white/5';
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-12 px-6">
      <h2 className="text-3xl font-bold mb-4">{t('complaints.title')}</h2>
      <p className="text-white/60 mb-8">{t('complaints.subtitle')}</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="glass-panel p-8 h-fit sticky top-8">
            <h3 className="text-lg font-bold mb-4">{t('complaints.submitTitle')}</h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('complaints.placeholder')}
              className="w-full h-48 bg-black/40 border border-white/10 rounded-xl p-6 mb-6 focus:outline-none focus:border-cyber-accent resize-none text-sm"
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="w-full cyber-button cyber-button-primary flex items-center justify-center gap-2 h-12"
            >
              <MessageSquareWarning size={20} />
              {t('complaints.submitBtn')}
            </button>
            {submitted && (
              <motion.p 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="text-cyber-accent text-center mt-4 font-bold text-sm"
              >
                {t('complaints.success')}
              </motion.p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="glass-panel p-8">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <History size={20} className="text-cyber-accent" />
              {user?.role === 'Admin' ? t('complaints.adminTitle') : t('complaints.historyTitle')}
            </h3>
            <div className="space-y-6">
              {allComplaints.map((c) => (
                <div key={c.id} className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <p className="text-sm text-white/90 leading-relaxed mb-2">{c.complaint_text}</p>
                      <div className="flex items-center gap-4 text-[10px] text-white/40 uppercase font-bold">
                        {user?.role === 'Admin' && <span className="text-cyber-accent">User: {c.user_email}</span>}
                        <span>ID: #{c.id}</span>
                        <span>{new Date(c.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                      {user?.role === 'Admin' && editingId !== c.id && (
                        <button 
                          onClick={() => {
                            setEditingId(c.id);
                            setEditStatus(c.status);
                            setEditNotes(c.reviewer_notes || '');
                          }}
                          className="text-[10px] font-bold text-cyber-accent hover:underline uppercase"
                        >
                          {t('complaints.moderate')}
                        </button>
                      )}
                    </div>
                  </div>

                  {editingId === c.id ? (
                    <div className="mt-4 p-4 bg-black/40 rounded-xl border border-cyber-accent/30 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">{t('complaints.status')}</label>
                          <select 
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-cyber-accent"
                          >
                            <option value="pending">{t('complaints.pending')}</option>
                            <option value="in-review">{t('complaints.inReview')}</option>
                            <option value="resolved">{t('complaints.resolved')}</option>
                            <option value="rejected">{t('complaints.rejected')}</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">{t('complaints.notes')}</label>
                        <textarea 
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder={t('complaints.notesPlaceholder')}
                          className="w-full bg-black/60 border border-white/10 rounded-lg p-3 text-xs focus:outline-none focus:border-cyber-accent h-24 resize-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleUpdateStatus(c.id)}
                          className="flex-1 bg-cyber-accent text-black font-bold py-2 rounded-lg text-xs hover:opacity-90 transition-all"
                        >
                          {t('complaints.save')}
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          className="flex-1 bg-white/5 text-white/60 font-bold py-2 rounded-lg text-xs hover:bg-white/10 transition-all"
                        >
                          {t('settings.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    c.reviewer_notes && (
                      <div className="mt-4 p-4 bg-cyber-accent/5 rounded-xl border border-cyber-accent/10">
                        <p className="text-[10px] font-bold text-cyber-accent uppercase mb-1">{t('complaints.notes')}</p>
                        <p className="text-xs text-white/70 italic">"{c.reviewer_notes}"</p>
                      </div>
                    )
                  )}
                </div>
              ))}
              {allComplaints.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-white/40">{t('complaints.noReports')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AuditLogsView = () => {
  const { t, language } = useI18n();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    userId: ''
  });

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      ...filters
    });
    const res = await fetch(`/api/audit?${params.toString()}`);
    const data = await res.json();
    setLogs(data.logs);
    setPagination(data.pagination);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs(1);
  }, [filters]);

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold flex items-center gap-3">
          <ClipboardList className="text-cyber-accent" size={32} />
          {t('audit.title')}
        </h2>
        <div className="flex items-center gap-4">
          <select 
            value={filters.action}
            onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cyber-accent"
          >
            <option value="">{t('audit.filters.allActions')}</option>
            <option value="LOGIN">LOGIN</option>
            <option value="REGISTER">REGISTER</option>
            <option value="DETECTION_SUBMIT">DETECTION_SUBMIT</option>
            <option value="COMPLAINT_UPDATE">COMPLAINT_UPDATE</option>
          </select>
          <select 
            value={filters.resource}
            onChange={(e) => setFilters(prev => ({ ...prev, resource: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cyber-accent"
          >
            <option value="">{t('audit.filters.allResources')}</option>
            <option value="auth">Auth</option>
            <option value="detections">Detections</option>
            <option value="complaints">Complaints</option>
            <option value="user">User</option>
          </select>
        </div>
      </div>

      <div className="glass-panel overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <th className="p-6">{t('audit.timestamp')}</th>
                <th className="p-6">{t('audit.user')}</th>
                <th className="p-6">{t('audit.action')}</th>
                <th className="p-6">{t('audit.resource')}</th>
                <th className="p-6">{t('audit.ip')}</th>
                <th className="p-6">{t('audit.details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Loader2 className="animate-spin text-cyber-accent mx-auto" />
                  </td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-6">
                    <span className="text-xs text-white/40 whitespace-nowrap">
                      {new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      }).format(new Date(log.timestamp))}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-cyber-accent">{log.user_name || 'System'}</span>
                      <span className="text-[10px] text-white/40">{log.user_email || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="px-2 py-1 rounded bg-white/5 text-[10px] font-bold uppercase border border-white/10">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-6">
                    <span className="text-xs text-white/60 capitalize">{log.resource}</span>
                  </td>
                  <td className="p-6">
                    <span className="text-xs font-mono text-white/40">{log.ip_address}</span>
                  </td>
                  <td className="p-6">
                    <pre className="text-[10px] text-white/40 font-mono max-w-xs truncate">
                      {log.details}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-white/40">
          Showing {logs.length} of {pagination.total} logs
        </p>
        <div className="flex gap-2">
          <button 
            onClick={() => fetchLogs(pagination.page - 1)}
            disabled={pagination.page === 1 || loading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => fetchLogs(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages || loading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

const HistoryView = ({ user }: { user: User | null }) => {
  const { t, language } = useI18n();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({
    search: '',
    riskLevel: '',
    prediction: '',
    sortBy: 'timestamp',
    sortOrder: 'DESC'
  });

  const fetchHistory = async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '15',
      ...filters
    });
    const res = await fetch(`/api/detections?${params.toString()}`);
    const data = await res.json();
    setHistory(data.detections);
    setPagination(data.pagination);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory(1);
  }, [filters]);

  const toggleSort = (field: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'DESC' ? 'ASC' : 'DESC'
    }));
  };

  return (
    <div className="p-12 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">{t('history.title')}</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input 
              type="text"
              placeholder={t('history.search')}
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-cyber-accent w-64"
            />
          </div>
          <select 
            value={filters.riskLevel}
            onChange={(e) => setFilters(prev => ({ ...prev, riskLevel: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cyber-accent"
          >
            <option value="">{t('dashboard.filters.allRisks')}</option>
            <option value="Low">{t('detect.low')}</option>
            <option value="Medium">{t('detect.medium')}</option>
            <option value="High">{t('detect.high')}</option>
          </select>
          <select 
            value={filters.prediction}
            onChange={(e) => setFilters(prev => ({ ...prev, prediction: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cyber-accent"
          >
            <option value="">{t('dashboard.filters.allTypes')}</option>
            <option value="Scam">{t('detect.scam')}</option>
            <option value="Safe">{t('detect.safe')}</option>
          </select>
        </div>
      </div>

      <div className="glass-panel overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <th className="p-6">{t('history.table.message')}</th>
                <th className="p-6">{t('history.table.prediction')}</th>
                <th className="p-6 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('riskLevel')}>
                  {t('history.table.risk')} {filters.sortBy === 'riskLevel' && (filters.sortOrder === 'DESC' ? '↓' : '↑')}
                </th>
                <th className="p-6 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('confidence')}>
                  {t('history.table.confidence')} {filters.sortBy === 'confidence' && (filters.sortOrder === 'DESC' ? '↓' : '↑')}
                </th>
                <th className="p-6 cursor-pointer hover:text-white transition-colors" onClick={() => toggleSort('timestamp')}>
                  {t('history.table.date')} {filters.sortBy === 'timestamp' && (filters.sortOrder === 'DESC' ? '↓' : '↑')}
                </th>
                {(user?.role === 'Admin' || user?.role === 'Analyst') && <th className="p-6">{t('history.table.user')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Loader2 className="animate-spin text-cyber-accent mx-auto" />
                  </td>
                </tr>
              ) : history.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-6 max-w-md">
                    <p className="text-sm text-white/80 line-clamp-1">{item.message_text}</p>
                  </td>
                  <td className="p-6">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      item.verdict === 'Scam' ? 'bg-cyber-danger/20 text-cyber-danger' : 'bg-cyber-accent/20 text-cyber-accent'
                    }`}>
                      {t(`detect.${item.verdict.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="p-6">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      item.riskLevel === 'High' ? 'bg-cyber-danger/20 text-cyber-danger' : 
                      item.riskLevel === 'Medium' ? 'bg-cyber-warning/20 text-cyber-warning' : 'bg-cyber-accent/20 text-cyber-accent'
                    }`}>
                      {t(`detect.${item.riskLevel.toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="p-6">
                    <span className="text-sm font-mono text-white/60">
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-6">
                    <span className="text-xs text-white/40 whitespace-nowrap">
                      {new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
                        dateStyle: 'medium'
                      }).format(new Date(item.timestamp))}
                    </span>
                  </td>
                  {(user?.role === 'Admin' || user?.role === 'Analyst') && (
                    <td className="p-6">
                      <span className="text-xs text-cyber-accent font-bold">{item.user_name}</span>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && history.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-white/40">
                    No detection history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center px-4">
          <p className="text-xs text-white/40">
            {t('history.pagination').replace('{count}', history.length.toString()).replace('{total}', pagination.total.toString())}
          </p>
          <div className="flex items-center gap-2">
            <button 
              disabled={pagination.page === 1}
              onClick={() => fetchHistory(pagination.page - 1)}
              className="p-2 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-white/60 px-4">
              {t('history.page').replace('{current}', pagination.page.toString()).replace('{total}', pagination.totalPages.toString())}
            </span>
            <button 
              disabled={pagination.page === pagination.totalPages}
              onClick={() => fetchHistory(pagination.page + 1)}
              className="p-2 bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const NotificationLogsView = () => {
  const { t, language } = useI18n();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications/logs')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch notification logs", err);
        setLogs([]);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-cyber-accent" /></div>;

  return (
    <div className="p-12 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Bell className="text-cyber-danger" />
        {t('notifications.title')}
      </h2>
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <th className="p-6">{t('notifications.table.id')}</th>
                <th className="p-6">{t('notifications.table.channel')}</th>
                <th className="p-6">{t('notifications.table.recipient')}</th>
                <th className="p-6">{t('notifications.table.status')}</th>
                <th className="p-6">{t('notifications.table.date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-6 text-sm font-mono text-white/60">#{log.detection_id}</td>
                  <td className="p-6">
                    <span className="text-xs font-bold uppercase text-white/80">{log.channel}</span>
                  </td>
                  <td className="p-6 text-sm text-white/60">{log.recipient}</td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      {log.status === 'sent' ? (
                        <CheckCircle2 size={14} className="text-cyber-accent" />
                      ) : (
                        <XCircle size={14} className="text-cyber-danger" />
                      )}
                      <span className={`text-xs font-bold uppercase ${log.status === 'sent' ? 'text-cyber-accent' : 'text-cyber-danger'}`}>
                        {log.status}
                      </span>
                    </div>
                    {log.error_message && <p className="text-[10px] text-cyber-danger mt-1">{log.error_message}</p>}
                  </td>
                  <td className="p-6 text-xs text-white/40">
                    {new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    }).format(new Date(log.timestamp))}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-white/40">
                    {t('notifications.noLogs')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ user, onUpdateUser, onLogout }: { 
  user: User & { email_notifications?: number, webhook_notifications?: number } | null, 
  onUpdateUser: (u: any) => void,
  onLogout: () => void
}) => {
  const { t, language, setLanguage } = useI18n();
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [notifications, setNotifications] = useState({
    email: user?.email_notifications === 1,
    webhook: user?.webhook_notifications === 1
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        onUpdateUser({ ...user, ...profile });
        setMessage({ type: 'success', text: t('settings.profileSuccess') });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: t('settings.updateError') });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      return setMessage({ type: 'error', text: t('settings.passMismatch') });
    }
    setLoading(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new })
      });
      if (res.ok) {
        setPasswords({ current: '', new: '', confirm: '' });
        setMessage({ type: 'success', text: t('settings.passSuccess') });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: t('settings.passError') });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotification = async (type: 'email' | 'webhook') => {
    const newPrefs = { ...notifications, [type]: !notifications[type] };
    setNotifications(newPrefs);
    try {
      await fetch('/api/user/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_notifications: newPrefs.email, webhook_notifications: newPrefs.webhook })
      });
      onUpdateUser({ ...user, email_notifications: newPrefs.email ? 1 : 0, webhook_notifications: newPrefs.webhook ? 1 : 0 });
    } catch (err) {
      console.error("Failed to update notification preferences", err);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const res = await fetch('/api/user', { method: 'DELETE' });
      if (res.ok) {
        onLogout();
      }
    } catch (err) {
      setMessage({ type: 'error', text: t('settings.deleteError') });
    }
  };

  return (
    <div className="p-12 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <SettingsIcon className="text-cyber-accent" />
        {t('settings.title')}
      </h2>

      {message.text && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl mb-8 flex items-center gap-3 ${
            message.type === 'success' ? 'bg-cyber-accent/10 text-cyber-accent border border-cyber-accent/20' : 'bg-cyber-danger/10 text-cyber-danger border border-cyber-danger/20'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span className="text-sm font-bold">{message.text}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Section */}
        <div className="glass-panel p-8">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <UserIcon size={18} className="text-cyber-accent" />
            {t('settings.profile')}
          </h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">{t('settings.name')}</label>
              <input 
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({...profile, name: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-cyber-accent"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">{t('settings.email')}</label>
              <input 
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({...profile, email: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-cyber-accent"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full cyber-button cyber-button-primary h-11 text-xs font-bold uppercase"
            >
              {t('settings.update')}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="glass-panel p-8">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Lock size={18} className="text-cyber-accent" />
            {t('settings.security')}
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">{t('settings.currentPass')}</label>
              <input 
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-cyber-accent"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">{t('settings.newPass')}</label>
              <input 
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-cyber-accent"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">{t('settings.confirmPass')}</label>
              <input 
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-cyber-accent"
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full cyber-button cyber-button-primary h-11 text-xs font-bold uppercase"
            >
              {t('settings.changePass')}
            </button>
          </form>
        </div>

        {/* Notifications Section */}
        <div className="glass-panel p-8">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Bell size={18} className="text-cyber-accent" />
            {t('settings.notifications')}
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{t('settings.emailAlerts')}</p>
                <p className="text-[10px] text-white/40 uppercase">{t('settings.emailAlertsDesc')}</p>
              </div>
              <button 
                onClick={() => handleToggleNotification('email')}
                className={`transition-colors ${notifications.email ? 'text-cyber-accent' : 'text-white/20'}`}
              >
                {notifications.email ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{t('settings.webhookAlerts')}</p>
                <p className="text-[10px] text-white/40 uppercase">{t('settings.webhookAlertsDesc')}</p>
              </div>
              <button 
                onClick={() => handleToggleNotification('webhook')}
                className={`transition-colors ${notifications.webhook ? 'text-cyber-accent' : 'text-white/20'}`}
              >
                {notifications.webhook ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>
          </div>
        </div>

        {/* Language Selection Section */}
        <div className="glass-panel p-8">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Layers size={18} className="text-cyber-accent" />
            {t('settings.language')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setLanguage('en')}
              className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                language === 'en' ? 'bg-cyber-accent/10 border-cyber-accent text-cyber-accent' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
              }`}
            >
              <span className="text-xl">🇺🇸</span>
              <span className="text-xs font-bold uppercase">English</span>
            </button>
            <button 
              onClick={() => setLanguage('es')}
              className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                language === 'es' ? 'bg-cyber-accent/10 border-cyber-accent text-cyber-accent' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
              }`}
            >
              <span className="text-xl">🇪🇸</span>
              <span className="text-xs font-bold uppercase">Español</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="glass-panel p-8 border-cyber-danger/20">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-cyber-danger">
            <Trash2 size={18} />
            {t('settings.danger')}
          </h3>
          <p className="text-xs text-white/40 mb-6 leading-relaxed">
            {t('settings.deleteDesc')}
          </p>
          {!showDeleteConfirm ? (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 border border-cyber-danger/40 text-cyber-danger rounded-xl text-xs font-bold uppercase hover:bg-cyber-danger/10 transition-all"
            >
              {t('settings.deleteBtn')}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-cyber-danger uppercase text-center mb-2">{t('settings.deleteConfirm')}</p>
              <button 
                onClick={handleDeleteAccount}
                className="w-full bg-cyber-danger text-white py-3 rounded-xl text-xs font-bold uppercase hover:opacity-90 transition-all"
              >
                {t('settings.deleteYes')}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full bg-white/5 text-white/60 py-3 rounded-xl text-xs font-bold uppercase hover:bg-white/10 transition-all"
              >
                {t('settings.cancel')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User & { email_verified?: number } | null>(null);
  const [activeTab, setActiveTab] = useState('detect');
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('en');

  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('token');
  const isReset = window.location.pathname === '/reset-password';
  const isVerify = window.location.pathname === '/verify-email';

  const t = (path: string) => {
    const keys = path.split('.');
    let current: any = translations[language];
    for (const key of keys) {
      if (current[key] === undefined) return path;
      current = current[key];
    }
    return current;
  };

  // Bootstrap Auth State
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("[Auth] Checking session...");
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const text = await res.text();
          console.log("[Auth] Session check response:", text);
          if (text) {
            try {
              const data = JSON.parse(text);
              setUser(data);
            } catch (parseErr) {
              console.error("[Auth] Failed to parse auth data", parseErr);
            }
          }
        } else {
          console.log("[Auth] Session check failed with status:", res.status);
        }
      } catch (err) {
        console.error("[Auth] Auth check failed", err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const handleRequestVerification = async () => {
    try {
      const res = await fetch('/api/auth/request-verification', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
    } catch (err) {
      alert('Failed to request verification.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-black flex items-center justify-center">
        <Loader2 className="animate-spin text-cyber-accent" size={48} />
      </div>
    );
  }

  if (isReset && resetToken) {
    return <ResetPasswordView token={resetToken} onComplete={() => window.location.href = '/'} />;
  }

  if (isVerify && resetToken) {
    return <VerifyEmailView token={resetToken} onComplete={() => window.location.href = '/'} />;
  }

  if (!user) return <AuthView onLogin={handleLogin} />;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <div className="min-h-screen bg-cyber-black flex">
        <Navbar 
          user={user} 
          onLogout={handleLogout} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onRequestVerification={handleRequestVerification}
        />
        
        <main className="flex-1 ml-64 min-h-screen">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'detect' && <DetectionView user={user} />}
              {activeTab === 'dashboard' && <DashboardView user={user} />}
              {activeTab === 'complaints' && <ComplaintsView user={user} />}
              {activeTab === 'history' && <HistoryView user={user} />}
              {activeTab === 'notifications' && <NotificationLogsView />}
              {activeTab === 'audit' && <AuditLogsView />}
              {activeTab === 'settings' && <SettingsView user={user} onUpdateUser={setUser} onLogout={handleLogout} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </LanguageContext.Provider>
  );
}
