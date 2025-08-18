import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FormData from "form-data";
import { exec } from "child_process";

// __dirname for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve frontend.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend.html"));
});

// Multer upload folder
const upload = multer({ dest: "uploads/" });

// Transcription endpoint
app.post("/transcribe", upload.single("file"), async (req, res) => {
  const inputPath = req.file.path;
  const outputPath = inputPath + ".wav";

  // Convert WebM → WAV and boost volume by 30 dB
  exec(
    `ffmpeg -y -i ${inputPath} -ar 16000 -ac 1 -filter:a "volume=30dB" ${outputPath}`,
    async (err) => {
      if (err) {
        console.error("ffmpeg conversion error:", err);
        fs.unlinkSync(inputPath);
        return res.status(500).json({ transcription: "Audio conversion failed" });
      }

      try {
        const audioFile = fs.createReadStream(outputPath);

        const form = new FormData();
        form.append("file", audioFile);
        form.append("model", "whisper-1");

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer OPENAIAPIKEY` }, // Replace with your OpenAI API key
          body: form
        });

        const data = await response.json();
        console.log("Whisper API response:", data);

        // Cleanup temporary files
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        res.json({ transcription: data.text || "No transcription received" });
      } catch (error) {
        console.error(error);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        res.status(500).json({ transcription: "Transcription failed" });
      }
    }
  );
});

// Start server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
