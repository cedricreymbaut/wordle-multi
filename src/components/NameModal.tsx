import { useState } from 'react';

interface NameModalProps {
  onConfirm: (name: string) => void;
}

export function NameModal({ onConfirm }: NameModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length >= 2) {
      onConfirm(trimmed);
    }
  };

  return (
    <div className="overlay">
      <div className="modal">
        <h2 className="modal__title">Wordle Multi</h2>
        <p className="modal__sub">
          Devinez le mot du jour avec tout le monde !<br />
          Quand quelqu'un trouve, un nouveau mot commence.
        </p>
        <form onSubmit={handleSubmit} className="modal__form">
          <input
            className="modal__input"
            type="text"
            placeholder="Ton pseudo"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <button
            className="modal__btn"
            type="submit"
            disabled={name.trim().length < 2}
          >
            Jouer
          </button>
        </form>
      </div>
    </div>
  );
}
