# Stage 1: Build React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go Server
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app/server
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/teg-server ./cmd/server

# Stage 3: Final Production Image
FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates

COPY --from=backend-builder /app/teg-server /app/teg-server
COPY --from=frontend-builder /app/frontend/dist /app/public

ENV PORT=8080
ENV STATIC_DIR=/app/public

EXPOSE 8080

CMD ["/app/teg-server"]
