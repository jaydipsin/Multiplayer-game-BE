import app from "./app"
import connectDB from "./config/db";
import cors from "cors";
import express from "express";

import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 5000;
app.use(
  cors({
    origin: "http://localhost:4200", // frontend origin
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
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
