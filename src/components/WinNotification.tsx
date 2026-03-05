import { Confetti } from './Confetti';

interface WinNotificationProps {
  winnerName: string;
  word: string;
  isMe: boolean;
  guesses: number;
  countdown: number;
}

export function WinNotification({ winnerName, word, isMe, guesses, countdown }: WinNotificationProps) {
  const isNobody = !winnerName;

  return (
    <>
      {isMe && <Confetti />}
      <div className="overlay">
        <div className={`notification${isMe ? ' notification--win' : ''}`}>
          {isMe ? (
            <>
              <div className="notification__emoji">🎉</div>
              <h2 className="notification__title">Bravo !</h2>
              <p className="notification__sub">
                Tu as trouvé <strong>{word}</strong> en {guesses} essai{guesses > 1 ? 's' : ''} !
              </p>
            </>
          ) : isNobody ? (
            <>
              <div className="notification__emoji">💀</div>
              <h2 className="notification__title">Personne n'a trouvé !</h2>
              <p className="notification__sub">
                Le mot était <strong>{word}</strong>
              </p>
            </>
          ) : (
            <>
              <div className="notification__emoji">😅</div>
              <h2 className="notification__title">{winnerName} a trouvé !</h2>
              <p className="notification__sub">
                Le mot était <strong>{word}</strong> — trouvé en {guesses} essai{guesses > 1 ? 's' : ''}.
              </p>
            </>
          )}
          <p className="notification__countdown">
            Nouveau mot dans <strong>{countdown}</strong>s…
          </p>
        </div>
      </div>
    </>
  );
}
