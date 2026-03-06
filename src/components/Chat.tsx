import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

interface ChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  currentPlayer: string;
}

export function Chat({ messages, onSend, currentPlayer }: ChatProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const doSend = () => {
    const trimmed = input.trim();
    if (trimmed.length === 0 || trimmed.length > 200) return;
    try {
      onSend(trimmed);
      setInput('');
    } catch {
      // silently ignore
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  };

  return (
    <div className="chat">
      <div className="chat__messages" ref={listRef}>
        {messages.length === 0 ? (
          <p className="chat__empty">Pas encore de message…</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === currentPlayer;
            return (
              <div key={msg.id} className={`chat__msg${isMe ? ' chat__msg--me' : ''}`}>
                {!isMe && <span className="chat__sender">{msg.sender}</span>}
                <span className="chat__text">{msg.text}</span>
              </div>
            );
          })
        )}
      </div>
      <form className="chat__form" onSubmit={handleSubmit}>
        <input
          className="chat__input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message…"
          maxLength={200}
          autoComplete="off"
          onKeyDown={handleKeyDown}
        />
        <button
          className="chat__send"
          type="button"
          onClick={doSend}
        >
          ➤
        </button>
      </form>
    </div>
  );
}
