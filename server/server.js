import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
//import bcrypt from 'bcrypt';
//import db from '../src/config/db.js';
import Message from '../src/models/message.js';

import routes from '../src/routers/routes.js';
import dotenv from 'dotenv';
//import { body, validationResult } from 'express-validator';
// Optional: enable CORS if frontend is on different domain/port
import cors from 'cors';

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

  socket.on('register', (userPhone) => {
    users.set(userPhone, socket);
    console.log('User registered:', userPhone);
  
  });

  socket.on('send_message', async (data) => {
  const { sender, receiver, text } = data;

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
});


  socket.on('disconnect', () => {
  for (let [phone, s] of users.entries()) {
    if (s === socket) users.delete(phone);
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

