DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS channel_subscribers CASCADE; -- mp
DROP TABLE IF EXISTS server_members CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS servers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS channel_type CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;

CREATE TYPE user_status AS ENUM ('ONLINE', 'AWAY', 'BUSY', 'OFFLINE');
CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE channel_type AS ENUM ('TEXT', 'DM', 'VOICE'); -- setup les mp

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    status user_status DEFAULT 'ONLINE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    langue VARCHAR(10) DEFAULT 'fr' -- pour la gestion de la langue 
);

CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url TEXT,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    owner_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100), -- null en cas de mp
    description TEXT,
    kind channel_type DEFAULT 'TEXT',
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_server_link CHECK (
        ((kind = 'TEXT' OR kind = 'VOICE') AND server_id IS NOT NULL) OR 
        (kind = 'DM' AND server_id IS NULL)
    )
);

CREATE TABLE server_members (
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'MEMBER',
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (server_id, user_id)
);

CREATE TABLE channel_subscribers (
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(50) NOT NULL,
    author VARCHAR(50) NOT NULL,
    author_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX idx_server_invite ON servers(invite_code);
CREATE INDEX idx_members_user ON server_members(user_id);

CREATE TABLE server_bans (
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    banned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    PRIMARY KEY (server_id, user_id)
);

CREATE TABLE message_reactions (
    message_id INT REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE user_trophies (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trophy_id VARCHAR(100) NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, trophy_id)
);

CREATE INDEX idx_reactions_message ON message_reactions(message_id);
