# Sync API

Een multi-tenant API voor chatbot widget management gebouwd met Fastify, Prisma en TypeScript.

## 🚀 Features

- **Multi-tenant architectuur** - Isolatie per organisatie
- **Uitnodiging-gebaseerd lidmaatschap** - Gebruikers kunnen alleen via uitnodigingen lid worden van organisaties
- **Chatbot management** - Aanmaken en beheren van chatbots voor customer support widgets
- **Geavanceerde authenticatie** - Met TOTP/HOTP 2FA ondersteuning
- **Rechten management** - Uitgebreid systeem voor autorisatie
- **Rate limiting** - Bescherming tegen misbruik
- **API documentatie** - Automatisch gegenereerde Swagger/OpenAPI docs
- **Type-safe** - Volledig gebouwd met TypeScript en Zod validatie

## 🛠 Tech Stack

- **Fastify** - Fast and efficient web framework
- **Prisma** - Type-safe database ORM
- **PostgreSQL** - Database
- **TypeScript** - Type safety en developer experience
- **Zod** - Schema validatie
- **Argon2** - Password hashing
- **Jose** - JWT alternatieven
- **Pino** - High performance logging
- **Swagger UI** - Interactive API documentation

## ⚡ Quick Start

### 1. Clone het project
```bash
git clone https://github.com/Lars-Hoofs/sync.git
cd sync
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment setup
Kopieer `.env.example` naar `.env` en vul de juiste waarden in.

### 4. Database setup

Genereer Prisma client:
```bash
npm run db:generate
```

Run database migrations:
```bash
npm run db:migrate
```

Seed de database met test data:
```bash
npm run db:seed
```

### 5. Start de development server
```bash
npm run dev
```

De API is nu beschikbaar op:
- **API**: http://localhost:3000
- **Documentation**: http://localhost:3000/docs
- **Health check**: http://localhost:3000/health

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database with test data
```

## 📖 API Documentation

Na het starten van de server is de interactieve API documentatie beschikbaar op:
http://localhost:3000/docs

## 🔐 Test Gebruiker

Na het seeden is er een test gebruiker beschikbaar:
- Email: `test@example.com`
- Password: `TestWachtwoord123!`


