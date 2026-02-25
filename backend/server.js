const express = require("express");
const mongoose = require("mongoose");
const app = express();

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

app.listen(5000, "0.0.0.0", () => console.log("Backend running on port 5000"));