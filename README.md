# TEG-GO

Fork moderno del clásico juego de estrategia TEG, basado en el trabajo original del equipo de [Team TNT](https://github.com/Team-TNT/TEGNet). Este repositorio mantiene el espíritu del proyecto original y lo lleva adelante con una arquitectura más actual, separando frontend y backend y dejando la base para continuar el desarrollo de una versión web más mantenible y extensible.

## ¿Qué es TEG-GO?

TEG-GO es una reimplementación y evolución del conocido juego de mesa TEG (Teoria del juego de conquista territorial). El objetivo es recrear la experiencia de partidas en línea, con tablero, fichas, turnos, misiones y mecánicas de conquista, pero utilizando tecnologías modernas para facilitar ejecución, desarrollo y mantenimiento.

Este proyecto combina:

- Frontend en React + TypeScript + Vite
- Backend en Go
- Comunicación en tiempo real con WebSockets
- Estructura modular para partidas, salas, bots y lógica del juego
- Preparación para despliegue con Docker

## Créditos

Este proyecto se inspira y parte del trabajo original de [Team TNT](https://github.com/Team-TNT/TEGNet), quienes desarrollaron la base del TEG clásico. Agradecemos profundamente el esfuerzo, la idea y la arquitectura original que dio origen a esta continuidad.

## Estado del proyecto

Actualmente este repositorio se encuentra en una etapa de refactor y evolución del proyecto original. La base funcional se está reorganizando para una versión moderna con un Frontend web y un servidor Go con arquitectura más limpia.

## Stack técnico

### Frontend
- React 19
- TypeScript
- Vite
- CSS moderno
- Componentes React para tablero, lobby, partidas y pantallas del juego

### Backend
- Go 1.22
- WebSockets
- Lógica del juego modularizada
- Manejo de salas y conexiones

### Infraestructura
- Docker
- Docker Compose
- Build multi-stage para frontend y backend

## Estructura del repositorio

```text
.
├── frontend/                 # aplicación web del cliente
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── server/                   # backend en Go
│   ├── cmd/
│   ├── internal/
│   ├── go.mod
│   └── go.sum
├── legacy/                   # proyecto original preservado
│   ├── Docs/
│   ├── TegNet/
│   ├── Servidor/
│   └── JV/
├── Dockerfile                # imagen de producción
├── docker-compose.yml        # entorno de ejecución local
├── README.md
├── CONTRIBUTING.md
└── ...
```

La carpeta `legacy/` conserva el código histórico y las herramientas originales del TEG clásico, sin interferir con el desarrollo del fork moderno.

## Cómo correrlo localmente

### Requisitos

- Node.js 22+
- Go 1.22+
- Docker y Docker Compose (opcional)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd server
go mod download
go run ./cmd/server
```

### Con Docker

```bash
docker compose up --build
```

## Variables y configuración

El backend está preparado para funcionar con una configuración simple de entorno, y el proyecto incluye un Dockerfile que compila tanto frontend como backend para ejecución en un solo contenedor.

## Roadmap sugerido

- estabilizar el servidor y la lógica del juego
- completar la sincronización del estado de partidas
- mejorar la UI del tablero y el lobby
- consolidar bots y partidas IA
- agregar persistencia y autenticación
- preparar despliegue en entorno real

## Contribuciones

Las contribuciones son bienvenidas. Si querés colaborar, podés hacer un fork del repositorio, crear una rama con tu cambio y abrir un pull request.

## Licencia

El proyecto original tiene un estado de licencia no definido indicado en la documentación original. Este fork mantiene el enfoque de continuidad y respeto al trabajo base, pero la licencia final deberá definirse conforme al proyecto en evolución.

## Agradecimientos

- [Team TNT](https://github.com/Team-TNT/TEGNet) por el proyecto original, preservado en `legacy/`
- Comunidad de desarrolladores del TEG
- Todo el equipo que continúe con la evolución de esta versión moderna
