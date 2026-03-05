import { useState, useRef, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length > 0 && trimmed.length <= 200) {
      onSend(trimmed);
      setInput('');
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
          // Prevent game keyboard from capturing keys when typing
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button className="chat__send" type="submit" disabled={!input.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
