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

```
sync/
├── prisma/              # Database schema and migrations
│   └── schema.prisma    # Prisma database schema
├── src/                 # TypeScript source code
│   ├── index.ts         # Main Fastify server entry point
│   ├── lib/             # Utility functions and shared code
│   │   └── prisma.ts    # Prisma client singleton
│   └── routes/          # API route handlers
│       └── api.ts       # Main API routes
├── dist/                # Compiled JavaScript (auto-generated)
├── .env.example         # Environment variables template
├── .env                 # Your environment variables (create this)
└── package.json         # Project dependencies and scripts
```

**Important Notes:**
- Only edit files in `src/` - never modify files in `dist/`
- The `dist/` folder is auto-generated when you run `npm run build`
- All `.js`, `.js.map`, and `.d.ts` files are compiled output - don't edit them manually

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
