-- =============================================
-- WORDLE MULTI - Schéma Supabase
-- Coller dans Supabase > SQL Editor > New query
-- =============================================

-- Table des parties
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  winner_name TEXT,
  winner_guesses INT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Index pour trouver rapidement la partie active
CREATE INDEX idx_games_status_started ON games(status, started_at DESC);

-- RLS policies (accès public pour un jeu ouvert)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON games FOR SELECT USING (true);
CREATE POLICY "Public insert" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update" ON games FOR UPDATE USING (true);

-- Fonction atomique : termine la partie en cours + en démarre une nouvelle
-- Gère les race conditions (deux joueurs gagnent en même temps)
CREATE OR REPLACE FUNCTION complete_game(
  p_game_id UUID,
  p_winner_name TEXT,
  p_winner_guesses INT,
  p_new_word TEXT
) RETURNS JSON AS $$
DECLARE
  v_updated INT;
  v_new_game games;
BEGIN
  UPDATE games
  SET status = 'completed',
      winner_name = p_winner_name,
      winner_guesses = p_winner_guesses,
      ended_at = NOW()
  WHERE id = p_game_id AND status = 'active';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    -- Quelqu'un d'autre a déjà gagné
    RETURN json_build_object('success', false, 'message', 'Game already completed');
  END IF;

  INSERT INTO games (word, status, started_at)
  VALUES (p_new_word, 'active', NOW())
  RETURNING * INTO v_new_game;

  RETURN json_build_object('success', true, 'new_game', row_to_json(v_new_game));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Active Realtime sur la table games
-- (À faire aussi dans Supabase > Database > Replication > games)
ALTER PUBLICATION supabase_realtime ADD TABLE games;
