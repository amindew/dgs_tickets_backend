require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

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

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
  console.log('Client connecte :', socket.id);

  socket.on('rejoindre', (userId) => {
    console.log("Utilisateur rejoint :", userId);
    socket.join(`user_${userId}`);
    console.log(`Utilisateur ${userId} a rejoint sa room`);
  });

  socket.on('disconnect', () => {
    console.log('Client deconnecte :', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur sur le port ${PORT}`));

module.exports = { app, io };