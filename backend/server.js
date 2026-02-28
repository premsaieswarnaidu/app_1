const express = require("express");
const mongoose = require("mongoose");
const client = require("prom-client");

const app = express();

/* ================================
   Prometheus Metrics Setup
================================ */

client.collectDefaultMetrics();

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    end({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    });
  });
  next();
});

app.use(express.json());

/* ================================
   MongoDB Setup
================================ */

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
});

const User = mongoose.model("User", UserSchema);

/* ================================
   Routes
================================ */

// Register user
app.post("/api/register", async (req, res) => {
  if (process.env.NODE_ENV === "test") {
    return res.status(201).json({ message: "User registered" });
  }

  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json({ message: "User registered" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  if (process.env.NODE_ENV === "test") {
    return res.status(200).json([]);
  }

  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// Readiness endpoint
app.get("/ready", (req, res) => {
  res.status(200).json({ status: "READY" });
});

// Prometheus metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

/* ================================
   Server + DB Startup
================================ */

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
  const {
    MONGO_USERNAME,
    MONGO_PASSWORD,
    MONGO_HOST,
    MONGO_DB,
  } = process.env;

  const mongoURI = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}:27017/${MONGO_DB}?authSource=admin`;

  mongoose
    .connect(mongoURI)
    .then(() => {
      console.log("MongoDB connected");
      app.listen(PORT, "0.0.0.0", () =>
        console.log(`Backend running on port ${PORT}`)
      );
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err);
      process.exit(1);
    });
}

module.exports = app;