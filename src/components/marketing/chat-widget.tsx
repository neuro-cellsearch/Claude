"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageSquareText, X, Send } from "lucide-react";
import { cn } from "@/components/ui/cn";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi — I'm Kairo's assistant. Ask me about our automations, pricing or how onboarding works." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Braces matter: newer browsers return a Promise from scrollIntoView, which React
  // would otherwise treat as the effect cleanup function and crash on re-run.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text.slice(0, 1200) }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(1).slice(-14) }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setUnavailable(true);
      } else if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: res.status === 429 ? "You're sending messages quickly — please wait a moment." : "Sorry, I'm having trouble right now. Please use the contact form and the team will reply." }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: j.reply }]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[520px] max-h-[75dvh] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-line-strong bg-ink-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-fg">Kairo assistant</p>
              <p className="text-[11.5px] text-subtle">AI assistant · may make mistakes · not a human</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded p-1 text-muted hover:text-fg"><X size={18} /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13.5px] leading-relaxed", m.role === "user" ? "ml-auto bg-signal-500 text-white" : "bg-ink-750 text-fg/90")}>
                {m.content}
              </div>
            ))}
            {busy && <div className="w-16 rounded-xl bg-ink-750 px-3 py-2 text-[13px] text-muted">…</div>}
            {unavailable && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-[13px] text-fg/90">
                The AI assistant isn't switched on yet. Please <Link href="/contact" className="text-signal-300 underline">send us a message</Link> or <Link href="/book" className="text-signal-300 underline">book a consultation</Link>.
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={unavailable ? "Assistant unavailable" : "Type your question…"}
              disabled={unavailable}
              maxLength={1200}
              className="h-10 flex-1 rounded-lg border border-line-strong bg-ink-950 px-3 text-sm text-fg placeholder:text-subtle focus:border-signal-500 focus:outline-none"
              aria-label="Message"
            />
            <button type="submit" disabled={busy || unavailable} className="grid h-10 w-10 place-items-center rounded-lg bg-signal-500 text-white disabled:opacity-50" aria-label="Send"><Send size={16} /></button>
          </form>
          <p className="px-4 pb-2 text-[10.5px] text-subtle">Don't share sensitive information. See our <Link href="/privacy" className="underline">privacy policy</Link>.</p>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat assistant" : "Open chat assistant"}
        className="ml-auto flex h-13 items-center gap-2 rounded-full bg-signal-500 px-5 py-3.5 text-sm font-medium text-white shadow-[0_10px_40px_-10px_rgba(47,123,255,0.8)] transition hover:bg-signal-400"
        aria-expanded={open}
      >
        {open ? <X size={18} /> : <MessageSquareText size={18} />}
        {!open && <span className="hidden sm:inline">Ask Kairo</span>}
      </button>
    </div>
  );
}
