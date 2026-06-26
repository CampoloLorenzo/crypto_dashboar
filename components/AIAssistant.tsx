"use client";

import { useRef, useState } from "react";
import type { ChatMessage } from "@/types";

const QUICK_PROMPTS = [
  "Riassumi lo stato del mercato in 3 punti.",
  "Quali coin hanno il composite più alto e perché?",
  "Cosa significa l'attuale livello di Fear & Greed?",
  "Spiega i rischi delle coin in tier emerging.",
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;

    setError(null);
    setInput("");
    const history = messages;
    setMessages([...history, { role: "user", content: message }]);
    setLoading(true);

    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationHistory: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Errore");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
      });
    }
  }

  return (
    <div className="card flex flex-col h-[520px]">
      <div className="p-3 border-b border-base-700">
        <h2 className="font-semibold">Assistente AI</h2>
        <p className="text-[11px] text-slate-500">
          Analista oggettivo. Non è consulenza finanziaria.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Prompt rapidi:</p>
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="block w-full text-left text-sm px-3 py-2 rounded-lg
                  bg-base-700 hover:bg-base-600 transition-colors text-slate-300"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${
              m.role === "user"
                ? "bg-tier-momentum/20 ml-6"
                : "bg-base-700 mr-6"
            }`}
          >
            {m.content}
          </div>
        ))}

        {loading && (
          <div className="text-sm text-slate-500 mr-6 px-3 py-2">
            Claude sta scrivendo…
          </div>
        )}
        {error && (
          <div className="text-sm text-risk px-3 py-2">⚠️ {error}</div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3 border-t border-base-700 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Chiedi un'analisi…"
          className="flex-1 bg-base-900 border border-base-600 rounded-lg px-3 py-2
            text-sm outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-tier-momentum text-white text-sm
            font-medium disabled:opacity-50"
        >
          Invia
        </button>
      </form>
    </div>
  );
}
