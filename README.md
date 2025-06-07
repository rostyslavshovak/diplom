# Real-time Chat Demo

This repository contains a small web application that demonstrates a simple chat interface and webhook diagnostic tools. The project is built with **Vite**, **Tailwind CSS** and vanilla JavaScript. A webhook URL is used as the backend endpoint for sending and receiving messages.

## Technology Stack

- **Node.js & Vite** – development server and build tooling
- **Tailwind CSS** – styling framework
- **Vanilla JavaScript** – chat logic (`chat.js`) and diagnostic tests (`diagnostics.js`)
- **TypeScript configuration** – the project uses a Vite + TypeScript template, although the application code itself is plain JavaScript

## Local Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

By default Vite serves the application on [http://localhost:5173](http://localhost:5173). Open this URL in the browser to use the chat interface or `diagnostics.html`.

## Running with Docker

A `Dockerfile` is provided to build and run the project inside a container.

1. Build the image:
   ```bash
   docker build -t chat-app .
   ```
2. Run the container:
   ```bash
   docker run -p 4173:4173 chat-app
   ```
3. Visit [http://localhost:4173](http://localhost:4173) to view the site.

The container builds the project and serves the production build using `vite preview`.

## Repository Structure

- `index.html` / `chat.js` – chat client
- `diagnostics.html` / `diagnostics.js` – webhook diagnostic tools
- `src/` – Tailwind CSS entry file
- `tailwind.config.js` / `postcss.config.js` – Tailwind configuration
- `Dockerfile` – container configuration

Feel free to modify the webhook endpoint inside `chat.js` and `diagnostics.js` to point to your own backend service.
