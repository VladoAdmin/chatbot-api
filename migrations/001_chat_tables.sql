-- chat_sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_context JSONB DEFAULT '{}',
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now()
);

-- chat_messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert" ON chat_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous select own" ON chat_sessions FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert messages" ON chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous select messages" ON chat_messages FOR SELECT USING (true);

-- Indexes
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at DESC);
