# Vue.js + Fastify File Upload System

This project is a secure file upload system built with Vue.js for the frontend and Fastify for the backend. It allows users to upload files (PDF and XLSX), process them, and download the processed results.

## Project Structure

The project is divided into two main parts:

- `frontend/`: Vue.js frontend application
- `backend/`: Fastify backend server

## Features

- Secure file upload with CSRF protection
- File validation (size and type)
- Real-time processing status updates
- Binary file handling
- Download processed files
- Error handling and recovery
- Preview mode for testing

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

1. Clone the repository
2. Install dependencies for both frontend and backend:

\`\`\`bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
\`\`\`

### Configuration

Create a `.env` file in the `backend` directory with the following variables:

\`\`\`
PORT=3001
CSRF_TOKEN=your-csrf-token
N8N_WEBHOOK_URL=https://n8n-lab.web-magic.space/webhook/549264d6-e71f-4bf3-b459-1fbc91c3e2d0
\`\`\`

### Running the Application

1. Start the backend server:

\`\`\`bash
cd backend
npm run dev
\`\`\`

2. In a separate terminal, start the frontend development server:

\`\`\`bash
cd frontend
npm run dev
\`\`\`

3. Open your browser and navigate to `http://localhost:5173`

## Building for Production

### Backend

\`\`\`bash
cd backend
npm start
\`\`\`

### Frontend

\`\`\`bash
cd frontend
npm run build
\`\`\`

The built frontend will be in the `frontend/dist` directory, which can be served by any static file server.

## License

MIT
