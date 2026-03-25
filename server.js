import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "dist");
const indexPath = path.join(distPath, "index.html");

app.use(express.static(distPath));

app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

app.use((req, res, next) => {
  if (req.method !== "GET") {
    next();
    return;
  }

  if (!fs.existsSync(indexPath)) {
    res.status(500).send("dist/index.html not found");
    return;
  }

  res.sendFile(indexPath);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
