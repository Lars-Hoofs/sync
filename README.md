# Sync - Prisma + Fastify API Project

This is a high-performance API project built with **Fastify** and **Prisma**.

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Lars-Hoofs/sync.git
   cd sync
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your database:
   - Copy `.env.example` to `.env`
   - Update the `DATABASE_URL` in `.env`

4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

5. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

## Project Structure

- `prisma/` - Contains Prisma schema and migrations
- `src/` - Source code for the API
  - `src/index.ts` - Main Fastify server
  - `src/routes/` - API route modules
  - `src/lib/` - Utility functions and Prisma client
- `.env` - Environment variables (create from `.env.example`)

## API Endpoints

Once the server is running, you can access the following endpoints:

- `GET /` - API information and available endpoints
- `GET /api/health` - Health check endpoint
- `GET /api/status` - Database connection status
- `GET /api/items` - Example CRUD endpoint (placeholder)
- `POST /api/items` - Example create endpoint (placeholder)

## Tech Stack

- **Fastify** - Fast and efficient web framework
- **Prisma** - Type-safe database ORM
- **TypeScript** - Type safety and better developer experience
- **Node.js** - Runtime environment

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npx prisma studio` - Open Prisma Studio (database GUI)

## Environment Variables

Create a `.env` file with the following variables:

```
DATABASE_URL="your_database_connection_string"
```
