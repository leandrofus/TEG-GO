-- Esquema de TEGNet. Se aplica al arrancar el server; todo es idempotente.

CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    username      TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));

-- Sesiones de cuentas (user_id) y de invitados (guest_name, sin user_id)
CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    BIGINT REFERENCES users (id) ON DELETE CASCADE,
    guest_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions (expires_at);

-- Salas: los lugares y el tablero se guardan como JSON tal como los usa el server
CREATE TABLE IF NOT EXISTS rooms (
    code          TEXT PRIMARY KEY,
    name          TEXT        NOT NULL,
    max_players   INT         NOT NULL,
    password_hash TEXT        NOT NULL DEFAULT '',
    status        TEXT        NOT NULL,
    seats         JSONB       NOT NULL,
    board         JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rooms_status ON rooms (status);
CREATE INDEX IF NOT EXISTS rooms_seats ON rooms USING GIN (seats jsonb_path_ops);
