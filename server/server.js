import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
//import bcrypt from 'bcrypt';
import db from '../src/config/db.js';
import Message from '../src/models/message.js';

import routes from '../src/routers/routes.js';
import dotenv from 'dotenv';
//import { body, validationResult } from 'express-validator';
// Optional: enable CORS if frontend is on different domain/port
import cors from 'cors';
import redisClient from "../src/routers/helpers/redisClient.js";



// db.js



import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


//const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../src/dependencies')))

app.use(express.static(path.join(__dirname, '../public')));


const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin: '*', // change in production
    methods: ['GET', 'POST']
  }
});

app.use(cors());

// Store sockets by email/userId
const users = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('register', async (userPhone) => {
    // Save in local Map
    users.set(userPhone, socket);
    console.log('User registered:', userPhone);

    // Save in Redis (mark online, 15s expiry)
    await redisClient.set(`online:${userPhone}`, 'online', { EX: 15 });

    // Listen for heartbeat events from client
    socket.on('heartbeat', async () => {
      await redisClient.set(`online:${userPhone}`, 'online', { EX: 15 });
      // Optional: console.log(`${userPhone} heartbeat received`);
    });
  });

  socket.on('send_message', async(data) => {
  const { sender, receiver, text } = data;
   console.log("SEND API:", { sender, receiver, text });
   console.log("Users Map keys:", Array.from(users.keys()));

    try {
    const savedMessage = await Message.create({
      sender,
      receiver,
      text,
      timestamp: new Date()
    });

    console.log(`Trying to send to ${receiver}`);
    const receiverSocket = users.get(receiver);
    console.log('Receiver socket:', receiverSocket);

    if (receiverSocket) {
      receiverSocket.emit('receive_message', savedMessage); // ✅ emit full saved message with _id
    }

  } catch (err) {
    console.error('Socket message save error:', err);
  }

  db.query(
    "INSERT INTO messages (sender, receiver, text, status) VALUES (?, ?, ?, 'sent')",
    [sender, receiver, text],
    (err, result) => {
      if (err) return console.error("DB insert error:", err);

      const messageId = result.insertId;

      const receiverSocket = users.get(receiver);

      

      if (receiverSocket) {
        db.query("UPDATE messages SET status='delivered' WHERE id=?", [messageId]);

        const msgData = {
          id: messageId,
          sender,
          receiver,
          text,
          status: 'delivered',
          timestamp: new Date()
        };

        receiverSocket.emit('receive_message', msgData);

        // 🔹 Also send updated unread count
        db.query(
          "SELECT COUNT(*) AS unread FROM messages WHERE receiver=? AND sender=? AND status!='read'",
          [receiver, sender],
          (err, result) => {
            if (!err) {
              receiverSocket.emit('unread_count_update', {
                sender,
                unread: result[0].unread
              });
            }
          }
        );

        // Tell sender message is delivered
        socket.emit('message_status_update', msgData);
      }
    }
  );
});


socket.on('read_message', ({ messageId, sender }) => {
  db.query("UPDATE messages SET status='read' WHERE id=?", [messageId], (err) => {
    if (err) {
      console.error("DB update error:", err);
      return;
    }

    const senderSocket = users.get(sender);
    if (senderSocket) {
      senderSocket.emit('message_status_update', { id: messageId, status: 'read' });
    }
  });
});




  socket.on('disconnect', async () => {
    for (let [phone, s] of users.entries()) {
      if (s === socket) {
        users.delete(phone);
        await redisClient.del(`online:${phone}`);
        console.log(`${phone} went offline`);
      }
    }
    console.log('User disconnected:', socket.id);
  });
});




// app.use(cors()); // Uncomment if using frontend separately (e.g., React app on another port)
//app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html
app.use('/', routes);




// Start the server
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`✅ Server + Socket.IO running at http://localhost:${PORT}`);
});

