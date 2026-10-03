package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"teg-server/internal/api"
	"teg-server/internal/lobby"
	"teg-server/internal/store"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// La base de docker-compose (servicio "db"), expuesta para desarrollo
		dbURL = "postgres://teg:teg@localhost:5440/teg?sslmode=disable"
	}

	ctx := context.Background()
	st, err := store.Open(ctx, dbURL)
	if err != nil {
		log.Fatalf("Base de datos: %v", err)
	}
	defer st.Close()

	rooms := lobby.NewManager(st)
	if err := rooms.Restore(ctx); err != nil {
		log.Fatalf("Recuperando salas: %v", err)
	}
	rooms.StartJanitor(10 * time.Minute)

	log.Printf("Servidor TEGNet en el puerto :%s (websocket en /ws)", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), api.New(st, rooms).Routes()); err != nil {
		log.Fatalf("Error ejecutando servidor: %v", err)
	}
}
