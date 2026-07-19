// Script ponctuel : applique retroactivement aux comptes deja desactives
// la regle mise en place dans PATCH /users/:id/actif (qui ne s'applique
// qu'aux desactivations futures) - desassigne leurs tickets non resolus,
// les remet a "a_faire" et redemarre leur delai SLA.
const { Op } = require('sequelize');
const { User, Ticket, HistoriqueStatut } = require('../models');
require('dotenv').config();

async function rattraper() {
  const utilisateursInactifs = await User.findAll({ where: { actif: false } });

  let ticketsTraites = 0;

  for (const utilisateur of utilisateursInactifs) {
    const tickets = await Ticket.findAll({
      where: {
        assigne_id: utilisateur.id,
        statut: { [Op.ne]: 'resolu' },
        supprime: { [Op.not]: true },
      },
    });

    for (const ticket of tickets) {
      const statutAvant = ticket.statut;
      ticket.assigne_id = null;
      ticket.statut     = 'a_faire';
      ticket.ouvert_le  = new Date();
      ticket.resolu_le  = null;
      ticket.duree_resolution_min = null;
      await ticket.save();

      if (statutAvant !== 'a_faire') {
        await HistoriqueStatut.create({
          ticket_id:      ticket.id,
          ancien_statut:  statutAvant,
          nouveau_statut: 'a_faire',
          modifie_par:    utilisateur.id,
          modifie_le:     new Date(),
        });
      }

      ticketsTraites += 1;
      console.log(`Ticket ${ticket.reference} desassigne (etait a ${utilisateur.nom})`);
    }
  }

  console.log(`Termine : ${ticketsTraites} ticket(s) rattrape(s) sur ${utilisateursInactifs.length} compte(s) inactif(s).`);
  process.exit(0);
}

rattraper().catch(err => {
  console.error('Erreur script rattraperTicketsUtilisateursDesactives:', err);
  process.exit(1);
});
