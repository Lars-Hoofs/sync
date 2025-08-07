# Sync - Prisma API Project

This is a Prisma-based API project.

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
- `.env` - Environment variables (create from `.env.example`)

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
