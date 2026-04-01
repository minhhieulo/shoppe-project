require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { query } = require("./models/common.model");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL
  }
});

io.on("connection", (socket) => {
  socket.on("join_user_room", (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on("chat:send", async ({ sender_id, receiver_id, message }) => {
    await query("INSERT INTO messages(sender_id, receiver_id, message) VALUES(?, ?, ?)", [
      sender_id,
      receiver_id,
      message
    ]);
    const payload = { sender_id, receiver_id, message, created_at: new Date() };
    io.to(`user_${receiver_id}`).emit("chat:new", payload);
    io.to(`user_${sender_id}`).emit("chat:new", payload);
  });
});

const port = Number(process.env.PORT || 5000);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${port}`);
});
