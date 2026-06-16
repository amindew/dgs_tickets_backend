require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const authRoutes   = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth',    authRoutes);
app.use('/tickets', ticketRoutes);
app.get('/', (req, res) => {
  res.json({ status: 'success', message: 'API DGS Tickets' });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur sur le port ${PORT}`));