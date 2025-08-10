import express from 'express';
import bcrypt from 'bcrypt';

import db from '../config/db.js';
import connectMongo from '../config/mongo.js';

import dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import path from 'path';
import { fileURLToPath } from 'url';
// Optional: enable CORS if frontend is on different domain/port
// import cors from 'cors';

const routes=express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
await connectMongo();


dotenv.config();

//const routes = express();
routes.use(express.json());
// app.use(cors()); // Uncomment if using frontend separately (e.g., React app on another port)
//app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html
routes.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

routes.get('/chat.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', '../../services/chat.html'));
});

// ✅ Signup route
routes.post('/signup',
  [
    body('name').notEmpty(),
    body('email').isEmail(),
    body('phone_number').isMobilePhone(),
    body('gender').isIn(['Male', 'Female', 'Other']),
    body('password').isLength({ min: 6 }),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, phone_number, gender, password } = req.body;

    try {
      // Check if email or phone already exists
      const [existing] = await db.query(
        'SELECT * FROM users WHERE email = ? OR phone_number = ?',
        [email, phone_number]
      );

      if (existing.length > 0) {
        return res.status(409).json({ message: 'Email or phone already in use' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await db.query(
        'INSERT INTO users (name, email, phone_number, gender, password) VALUES (?, ?, ?, ?, ?)',
        [name, email, phone_number, gender, hashedPassword]
      );

      res.status(201).json({ message: 'Signup successful' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// ✅ Login route
routes.post('/login',
  [
    body('email').isEmail(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
      const user = rows[0];

      if (!user) return res.status(400).json({ message: 'Invalid email or password' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

      res.json({
        message: 'Login successful',
        user: {
          id: user.user_id,
          name: user.name,
          email: user.email,
          phone_number: user.phone_number
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);


// ✅ Check if user exists by email or phone number
// ✅ Check if user exists by email or phone number (updated to return phone)
routes.get('/api/users/check/:identifier', async (req, res) => {
  const { identifier } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ? OR phone_number = ?',
      [identifier, identifier]
    );

    if (rows.length === 0) {
      return res.json({ exists: false });
    }

    const user = rows[0];

    // Always return the phone number as the standard identifier
    res.json({
      exists: true,
      identifier: user.phone_number,  // 👈 this becomes the universal ID
      name: user.name,
      email: user.email
    });
  } catch (err) {
    console.error('Error checking user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



import Message from '../models/message.js';

// ✅ Send a message
routes.post('/api/messages', async (req, res) => {
  const { sender, receiver, text } = req.body;

  if (!sender || !receiver || !text) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    const message = new Message({ sender, receiver, text });
    await message.save();
    res.status(201).json({ message: 'Message sent' });
    console.log("Msg sent");
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Get messages between two users
routes.get('/api/messages/:sender/:receiver', async (req, res) => {
  const { sender, receiver } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender }
      ]
    }).sort({ timestamp: 1 });

    res.json(messages);

    //test
    //console.log(messages);
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

routes.get('/messages/incoming/:user', async (req, res) => {
  //console.log('incoming called');
  const currentUser = decodeURIComponent(req.params.user);

  try {
    // Fetch all messages where user is either sender or receiver
    const allMessages = await Message.find({
      $or: [{ sender: currentUser }, { receiver: currentUser }]
    }).sort({ timestamp: -1 });

    const conversationMap = new Map();

    for (const msg of allMessages) {
      const otherUser = msg.sender === currentUser ? msg.receiver : msg.sender;

      // If not already stored, store this message as the latest in the conversation
      if (!conversationMap.has(otherUser)) {
        conversationMap.set(otherUser, msg);
      }
    }

    // Convert map to sorted array
    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(conversations);
    console.log("Fetching2 done");
  } catch (err) {
    console.error('Failed to fetch incoming messages:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});




export default routes;
