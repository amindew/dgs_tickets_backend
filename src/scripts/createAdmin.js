const bcrypt = require('bcrypt');
const { User } = require('../models');
require('dotenv').config();
async function createAdmin() { 
  const hash = await bcrypt.hash('Admin1234!', 10);
  await User.create({
    nom: 'Administrateur DGS',
    email: 'admin@dgs.sn',
    mot_de_passe: hash,
    role: 'admin',
  });
  console.log('Admin cree avec succes !');
  process.exit(0);
}
createAdmin();