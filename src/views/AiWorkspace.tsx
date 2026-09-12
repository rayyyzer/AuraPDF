import { useState } from 'react';
import type { Doc, Message } from '../types';
import { SUGGESTED_QUESTIONS } from '../data';
import {
  SparklesIcon, FileTextIcon, XIcon, SendIcon, LoaderIcon,
  CopyIcon, ChevronDownIcon, TableIcon, GlobeIcon, LayersIcon,
} from '../icons';

interface Props {
  docs: Doc[];
  onOpenDoc: (doc: Doc) => void;
}

export default function AiWorkspace({ docs, onOpenDoc }: Props) {
  const [selectedDocs, setSelectedDocs] = useState<Doc[]>([docs[0]]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [mode, setMode] = useState<'chat' | 'compare'>('chat');

  function toggleDoc(doc: Doc) {
    setSelectedDocs((prev) =>
      prev.find((d) => d.id === doc.id)
        ? prev.filter((d) => d.id !== doc.id)
        : [...prev, doc]
    );
  }

  async function sendMessage(content: string) {
    if (!content.trim() || thinking) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setThinking(true);

    await new Promise((r) => setTimeout(r, 1600));

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `Analyzing ${selectedDocs.map((d) => d.name).join(' and ')}...\n\nBased on the document${selectedDocs.length > 1 ? 's' : ''}, here is what I found regarding "${content}":\n\nThe key themes across the selected content include strategic growth initiatives, operational efficiency improvements, and forward-looking guidance. The data suggests continued momentum across primary business segments with particular strength in enterprise-tier relationships.`,
    };
    setMessages((m) => [...m, aiMsg]);
    setThinking(false);
  }

  const quickActions = [
    { label: 'Summarize all', icon: SparklesIcon, q: 'Summarize the key points from all selected documents' },
    { label: 'Extract data', icon: TableIcon, q: 'Extract all key figures and data points' },
    { label: 'Compare docs', icon: LayersIcon, q: 'Compare and contrast the selected documents' },
    { label: 'Translate', icon: GlobeIcon, q: 'Translate the main content to Spanish' },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-4 flex items-center gap-4 bg-card">
        <div>
          <div className="flex items-center gap-2">
            <SparklesIcon size={16} className="text-primary" />
            <h1 className="text-sm font-semibold text-foreground">Insights</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Multi-document intelligence</p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 border border-border ml-6">
          {(['chat', 'compare'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Document picker */}
          <div className="relative">
            <button
              onClick={() => setShowDocPicker(!showDocPicker)}
              className="flex items-center gap-2 px-3 py-2 text-xs bg-muted rounded-lg border border-border text-foreground hover:border-primary/30 transition-colors"
            >
              <FileTextIcon size={12} className="text-muted-foreground" />
              <span>{selectedDocs.length} document{selectedDocs.length !== 1 ? 's' : ''}</span>
              <ChevronDownIcon size={11} className="text-muted-foreground" />
            </button>

            {showDocPicker && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-card border border-border rounded-xl shadow-xl z-20 py-2 fade-in">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1">Select documents</p>
                <div className="max-h-64 overflow-y-auto">
                  {docs.map((doc) => {
                    const active = !!selectedDocs.find((d) => d.id === doc.id);
                    return (
                      <button
                        key={doc.id}
                        onClick={() => toggleDoc(doc)}
                        className={`flex items-center gap-3 w-full px-3 py-2 transition-colors ${active ? 'bg-primary/5' : 'hover:bg-muted'}`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-primary border-primary' : 'border-border'}`}
                        >
                          {active && <span className="text-primary-foreground text-[9px]">✓</span>}
                        </div>
                        <div
                          className="w-6 h-8 rounded flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${doc.color}18` }}
                        >
                          <FileTextIcon size={11} style={{ color: doc.color }} />
                        </div>
                        <span className="text-xs text-foreground truncate flex-1 text-left">{doc.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-border mt-2 px-3 pt-2">
                  <button
                    onClick={() => setShowDocPicker(false)}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected docs strip */}
      {selectedDocs.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 px-6 py-2.5 border-b border-border bg-card/50 overflow-x-auto">
          {selectedDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 transition-colors"
              style={{
                borderColor: `${doc.color}40`,
                color: doc.color,
                backgroundColor: `${doc.color}10`,
              }}
            >
              <FileTextIcon size={10} />
              <span className="max-w-[140px] truncate">{doc.name}</span>
              <button
                onClick={() => toggleDoc(doc)}
                className="hover:opacity-60 transition-opacity"
              >
                <XIcon size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <SparklesIcon size={24} className="text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground font-serif italic">Ask anything</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {selectedDocs.length === 1
                ? `I have fully read "${selectedDocs[0].name}". Ask me anything about it.`
                : `I have access to ${selectedDocs.length} documents. I can compare, summarize, or extract information across all of them.`}
            </p>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2 mt-6 w-full">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.q)}
                  className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg text-left hover:border-primary/30 hover:bg-primary/3 transition-colors"
                >
                  <action.icon size={13} className="text-primary shrink-0" />
                  <span className="text-xs font-medium text-foreground">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Suggested questions */}
            <div className="mt-5 flex flex-wrap gap-2 justify-center">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 bg-muted rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <AiMessage key={msg.id} msg={msg} />
            ))}
            {thinking && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <LoaderIcon size={13} className="text-primary spin-slow" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Analyzing documents</span>
                  <div className="flex items-center gap-1">
                    {[0, 200, 400].map((d) => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground upload-pulse" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 p-4 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-card rounded-xl border border-border px-4 py-3 focus-within:border-primary/40 transition-colors">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={`Ask about ${selectedDocs.length} document${selectedDocs.length !== 1 ? 's' : ''}...`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || thinking}
              className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            >
              <SendIcon size={14} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            AuraPDF ·{selectedDocs.reduce((acc, d) => acc + d.pages, 0)} total pages analyzed
          </p>
        </div>
      </div>
    </div>
  );
}

function AiMessage({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 fade-in">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <SparklesIcon size={13} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">{msg.content}</div>
        <button className="mt-2 p-1 rounded hover:bg-muted text-muted-foreground transition-colors" title="Copy">
          <CopyIcon size={12} />
        </button>
      </div>
    </div>
  );
}
