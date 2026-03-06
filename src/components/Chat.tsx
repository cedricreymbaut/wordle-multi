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
    console.log('[Chat] doSend called with:', trimmed);
    try {
      onSend(trimmed);
      setInput('');
    } catch (err) {
      console.error('[Chat] onSend threw:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Chat] form submit');
    doSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Empêcher le jeu de capturer les touches dans l'input chat
    e.stopPropagation();
    // Sur mobile, certains navigateurs ne déclenchent pas le submit du form
    // → on gère Enter explicitement aussi
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('[Chat] Enter key pressed');
      doSend();
    }
  };

  console.log('[Chat] render, messages:', messages.length, 'currentPlayer:', currentPlayer);

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
          onClick={() => { console.log('[Chat] send button clicked'); doSend(); }}
        >
          ➤
        </button>
      </form>
    </div>
  );
}
