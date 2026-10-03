// Package store guarda usuarios, sesiones y salas en PostgreSQL.
package store

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schema string

var (
	ErrNotFound      = errors.New("no encontrado")
	ErrUsernameTaken = errors.New("ese nombre de usuario ya existe")
)

type Store struct {
	pool *pgxpool.Pool
}

// Open conecta a la base (reintentando mientras arranca) y aplica el esquema.
func Open(ctx context.Context, url string) (*Store, error) {
	var pool *pgxpool.Pool
	var err error
	for attempt := 1; ; attempt++ {
		pool, err = pgxpool.New(ctx, url)
		if err == nil {
			err = pool.Ping(ctx)
		}
		if err == nil {
			break
		}
		if pool != nil {
			pool.Close()
		}
		if attempt == 10 {
			return nil, fmt.Errorf("no se pudo conectar a la base: %w", err)
		}
		time.Sleep(time.Second)
	}

	if _, err := pool.Exec(ctx, schema); err != nil {
		pool.Close()
		return nil, fmt.Errorf("aplicando el esquema: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

// ---------------------------------------------------------------------------
// Usuarios y sesiones

type User struct {
	ID       int64
	Username string
}

func (s *Store) CreateUser(ctx context.Context, username, passwordHash string) (User, error) {
	u := User{Username: username}
	err := s.pool.QueryRow(ctx,
		`INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id`,
		username, passwordHash).Scan(&u.ID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return User{}, ErrUsernameTaken
	}
	return u, err
}

// UserWithPassword devuelve el usuario y el hash de su contraseña.
func (s *Store) UserWithPassword(ctx context.Context, username string) (User, string, error) {
	var u User
	var hash string
	err := s.pool.QueryRow(ctx,
		`SELECT id, username, password_hash FROM users WHERE lower(username) = lower($1)`,
		username).Scan(&u.ID, &u.Username, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, "", ErrNotFound
	}
	return u, hash, err
}

type Session struct {
	Token  string
	UserID int64 // 0 para invitados
	Name   string
	Guest  bool
}

func (s *Store) CreateSession(ctx context.Context, token string, userID int64, guestName string, ttl time.Duration) error {
	var uid any
	if userID > 0 {
		uid = userID
	}
	_, err := s.pool.Exec(ctx,
		`INSERT INTO sessions (token, user_id, guest_name, expires_at) VALUES ($1, $2, $3, $4)`,
		token, uid, guestName, time.Now().Add(ttl))
	return err
}

func (s *Store) GetSession(ctx context.Context, token string) (Session, error) {
	var sess Session
	var userID *int64
	var username, guestName *string
	err := s.pool.QueryRow(ctx, `
		SELECT s.token, s.user_id, u.username, s.guest_name
		FROM sessions s LEFT JOIN users u ON u.id = s.user_id
		WHERE s.token = $1 AND s.expires_at > now()`, token).
		Scan(&sess.Token, &userID, &username, &guestName)
	if errors.Is(err, pgx.ErrNoRows) {
		return Session{}, ErrNotFound
	}
	if err != nil {
		return Session{}, err
	}
	if userID != nil {
		sess.UserID, sess.Name = *userID, *username
	} else {
		sess.Guest = true
		if guestName != nil {
			sess.Name = *guestName
		}
	}
	return sess, nil
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE token = $1`, token)
	return err
}

// ---------------------------------------------------------------------------
// Salas

type RoomRecord struct {
	Code         string
	Name         string
	MaxPlayers   int
	PasswordHash string
	Status       string
	Seats        json.RawMessage
	Board        json.RawMessage // nil si la partida no empezó
	CreatedAt    time.Time
}

func (s *Store) SaveRoom(ctx context.Context, r RoomRecord) error {
	var board any
	if len(r.Board) > 0 {
		board = r.Board
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO rooms (code, name, max_players, password_hash, status, seats, board, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
		ON CONFLICT (code) DO UPDATE SET
			name = EXCLUDED.name, max_players = EXCLUDED.max_players,
			password_hash = EXCLUDED.password_hash, status = EXCLUDED.status,
			seats = EXCLUDED.seats, board = EXCLUDED.board, updated_at = now()`,
		r.Code, r.Name, r.MaxPlayers, r.PasswordHash, r.Status, r.Seats, board, r.CreatedAt)
	return err
}

func (s *Store) DeleteRoom(ctx context.Context, code string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM rooms WHERE code = $1`, code)
	return err
}

// ActiveRooms devuelve las salas que no terminaron, para recargarlas al arrancar.
func (s *Store) ActiveRooms(ctx context.Context) ([]RoomRecord, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT code, name, max_players, password_hash, status, seats, board, created_at
		FROM rooms WHERE status <> 'finished' ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []RoomRecord
	for rows.Next() {
		var r RoomRecord
		if err := rows.Scan(&r.Code, &r.Name, &r.MaxPlayers, &r.PasswordHash, &r.Status, &r.Seats, &r.Board, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
