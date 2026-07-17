require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const jwt = require('jsonwebtoken');

const authRoutes   = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const userRoutes   = require('./routes/users');
const statsRoutes  = require('./routes/stats'); // <- C

const app    = express();
const server = http.createServer(app);

const notifRoutes = require('./routes/notifications');

// Configurer Socket.IO avec CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Rendre io accessible dans toutes les routes
app.set('io', io);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/auth',    authRoutes);
app.use('/tickets', ticketRoutes);
app.use('/users',   userRoutes);
app.use('/stats',   statsRoutes); // <- C
app.use('/notifications', notifRoutes);

// Authentifier la connexion WebSocket via le JWT (empêche un client de
// rejoindre la room d'un autre utilisateur en envoyant un userId arbitraire)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentification requise'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Token invalide ou expiré'));
    }
    socket.userId = decoded.id;
    next();
  });
});

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
  console.log('Client connecte :', socket.id, '- utilisateur :', socket.userId);

  // La room est déterminée uniquement à partir du token vérifié ci-dessus,
  // jamais à partir d'une valeur fournie par le client.
  socket.join(`user_${socket.userId}`);

  socket.on('disconnect', () => {
    console.log('Client deconnecte :', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur sur le port ${PORT}`));

module.exports = { app, io };