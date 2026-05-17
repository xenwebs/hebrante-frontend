// === server/index.js ===

import dotenv from "dotenv"
dotenv.config()

import express from "express"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// Статические файлы (HTML, CSS, JS для браузера)
app.use(express.static(path.join(__dirname, "../public")))

// API маршруты
app.post("/api/bold-webhook", (req, res) => {
  console.log("Вебхук от Bold:", req.body)
  res.json({ success: true })
})

const PORT = process.env.PORT || 8000
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`)
})