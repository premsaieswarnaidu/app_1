const express = require("express");
const mongoose = require("mongoose");
const app = express();

// --- Prometheus client setup ---
const client = require("prom-client");
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics(); // collects CPU, memory, event loop lag, etc.

// Custom metric: HTTP request duration
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    end({ method: req.method, route: req.path, status_code: res.statusCode });
  });
  next();
});

app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const UserSchema = new mongoose.Schema({ name: String, email: String });
const User = mongoose.model("User", UserSchema);

app.post("/api/register", async (req, res) => {
  const user = new User(req.body);
  await user.save();
  res.send({ message: "User registered" });
});

app.get("/api/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.get("/health", (req, res) => res.send("OK"));
app.get("/ready", (req, res) => res.send("READY"));

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

app.listen(5000, "0.0.0.0", () => console.log("Backend running on port 5000"));
