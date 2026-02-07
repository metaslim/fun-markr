# Markr Frontend

React dashboard for the Markr test results microservice.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Features

- **Dashboard**: Overview of all tests with aggregate stats
- **Test List**: Browse all tests
- **Test Detail**: Statistics, charts, score distribution
- **Test Students**: View all students in a test with rankings
- **Student List**: Browse all students with search
- **Student Detail**: Individual student's test history
- **Import**: Upload XML files with real-time job status polling
- **AI Assistant**: Local LLM (Llama 3.2 3B) for help and data queries

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Recharts (visualizations)
- WebLLM (local AI)
- Zustand (state)

## Project Structure

```
src/
├── components/
│   └── ChatAgent.tsx      # AI assistant with function calling
├── pages/
│   ├── Home.tsx           # Dashboard
│   ├── TestList.tsx       # All tests
│   ├── TestDetail.tsx     # Test stats + charts
│   ├── TestStudents.tsx   # Students in a test
│   ├── StudentList.tsx    # All students
│   ├── StudentDetail.tsx  # Student profile
│   └── Import.tsx         # XML import
├── services/
│   └── api.ts             # API client
├── stores/
│   └── contextStore.ts    # AI context + state
├── types/
│   └── index.ts           # TypeScript types
└── App.tsx                # Routes + layout
```

## Environment

Create `.env` for custom API settings:

```env
VITE_API_URL=http://localhost:4567
VITE_API_USER=markr
VITE_API_PASS=secret
```

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint
```
