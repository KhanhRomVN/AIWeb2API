<p align="center">
  <img src="./resources/icon.png" width="128" height="128" alt="Elara Logo">
</p>

<h1 align="center">Elara Server</h1>

<p align="center">
  <strong>A Powerful, Lightweight AI Backend Proxy & Manager</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-68a063?style=flat-square&logo=node.js" alt="Node.js Version">
  <img src="https://img.shields.io/badge/SQLite-3-003b57?style=flat-square&logo=sqlite" alt="SQLite">
  <img src="https://img.shields.io/badge/License-ISC-blue?style=flat-square" alt="License">
</p>

---

Elara Server is a lightweight yet powerful backend server that provides a unified API for multiple AI providers (Claude, DeepSeek, Mistral, Groq, Qwen, etc.) while supporting secure local conversation data storage.

## ✨ Key Features

- 🚀 **Multi-Provider**: Pre-integrated with Claude, DeepSeek, Mistral, Groq, Qwen, and more.
- 🔌 **Unified API**: A single endpoint for all your AI needs.
- 💾 **Local Storage**: Automatic SQLite management in `~/.elara-backend/`.
- ⚡ **Optimized**: Super small footprint (~8MB bundle), starts instantly.
- 🛠️ **Flexible**: Can be run as a CLI or integrated directly into other Node.js projects.

## 🚀 Quick Install

Install globally via npm:

```bash
npm install -g @khanhromvn/elara-server
```

## 📖 Usage Guide

### Run the Server
Simply run the following command to start the API server:

```bash
elara-server
```

### Command Options
`elara-server` supports custom parameters:

- `--port, -p <number>`: Set the server port (default: `8888`).
- `--db-path <path>`: Specify a custom path for the SQLite database.

**Example:**
```bash
elara-server --port 9000 --db-path ./my-data.sqlite
```

## 📂 Data Storage

By default, Elara stores its database and configurations in:
`~/.elara-backend/database.sqlite`

## 📄 License

Released under the [ISC](LICENSE) license.

---
<p align="center">Designed by <strong>@khanhromvn</strong></p>
