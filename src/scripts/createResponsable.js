const bcrypt = require('bcrypt');
const { User } = require('../models');
require('dotenv').config();

async function createResponsable() {
  const hash = await bcrypt.hash('Resp1234!', 10);
  await User.create({
    nom: 'Responsable Test',
    email: 'responsable@dgs.sn',
    mot_de_passe: hash,
    role: 'responsable',
  });
  console.log('Responsable cree avec succes !');
  process.exit(0);
}

createResponsable();