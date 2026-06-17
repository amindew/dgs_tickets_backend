const bcrypt = require('bcrypt');
const { User, Ticket } = require('../models');
const { genererReference } = require('../utils/reference');
require('dotenv').config();

async function seeder() {
  console.log('Debut du seeder...');

  const hashAdmin = await bcrypt.hash('Admin1234!', 10);
  const hashResponsable = await bcrypt.hash('Resp1234!', 10);
  const hashTechnicien = await bcrypt.hash('Tech1234!', 10);

  const [admin] = await User.findOrCreate({
    where: { email: 'admin@dgs.sn' },
    defaults: { nom: 'Administrateur DGS', mot_de_passe: hashAdmin, role: 'admin' },
  });

  const [responsable] = await User.findOrCreate({
    where: { email: 'responsable@dgs.sn' },
    defaults: { nom: 'Responsable Test', mot_de_passe: hashResponsable, role: 'responsable' },
  });

  const [technicien] = await User.findOrCreate({
    where: { email: 'technicien@dgs.sn' },
    defaults: { nom: 'Technicien Test', mot_de_passe: hashTechnicien, role: 'technicien' },
  });

  const ticketsDemo = [
    {
      titre: 'Panne reseau bureau principal',
      description: 'Le reseau est inaccessible depuis 8h ce matin.',
      priorite: 'critique',
      statut: 'a_faire',
      client_nom: 'DGS Dakar',
      cree_par: responsable.id,
    },
    {
      titre: 'Bug sur le module de facturation',
      description: 'Les factures PDF ne se generent plus.',
      priorite: 'moyenne',
      statut: 'en_cours',
      client_nom: 'Client ABC',
      cree_par: responsable.id,
      assigne_id: technicien.id,
    },
    {
      titre: 'Mise a jour logiciel comptabilite',
      description: 'Mise a jour requise vers la version 3.2.',
      priorite: 'basse',
      statut: 'bloque',
      client_nom: 'Client XYZ',
      cree_par: admin.id,
      assigne_id: technicien.id,
    },
  ];

  for (const data of ticketsDemo) {
    const existant = await Ticket.findOne({ where: { titre: data.titre } });
    if (!existant) {
      const reference = await genererReference();
      await Ticket.create({ ...data, reference });
    }
  }

  console.log('Seeder termine !');
  process.exit(0);
}

seeder().catch(err => {
  console.error('Erreur seeder:', err);
  process.exit(1);
});