import app from "./app";
import connectDB from "./config/db";
import cors from "cors";
import http from "http";
import express from "express";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { SocketHandler } from "./sockets/index"; // ← HERE!
dotenv.config();

const PORT = process.env.PORT || 5000;
app.use(
  cors({
    origin: process.env.FE_STAGING_URL, // frontend origin
    // origin: "http://localhost:4200",
    credentials: true,
  })
);

// ✅ Add your CSP middleware here, before routes
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self' http://localhost:8000"
  );
  next();
});
app.use(express.json());
connectDB().then(() => {
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:4200", process.env.BE_STAGING_URL || ""], // Allow local and staging
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  const socketHandler = new SocketHandler(io);

  // Listen for new connections
  io.on("connection", (socket) => {
    socketHandler.handleConnection(socket);
  });
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
