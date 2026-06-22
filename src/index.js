require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const authRoutes   = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const userRoutes = require('./routes/users');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth',    authRoutes);
app.use('/tickets', ticketRoutes);
app.use('/users', userRoutes);
app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'API DGS Tickets' });
});
const path = require('path');
// Servir les fichiers du dossier uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// A ajouter avec les autres app.use(), avant les routes
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur sur le port ${PORT}`));