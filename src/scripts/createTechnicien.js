const bcrypt = require('bcrypt');
const { User } = require('../models');
require('dotenv').config();

async function createTechnicien() {
  const hash = await bcrypt.hash('Tech1234!', 10);
  await User.create({
    nom: 'Technicien Test',
    email: 'technicien@dgs.sn',
    mot_de_passe: hash,
    role: 'technicien',
  });
  console.log('Technicien cree avec succes !');
  process.exit(0);
}

createTechnicien();