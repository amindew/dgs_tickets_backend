const express = require('express');
const router  = express.Router();
const { Ticket } = require('../models');
const { verifierToken, autoriserRoles } = require('../middlewares/auth');
const { Op } = require('sequelize');

// GET /stats/kpi — Indicateurs pour le tableau de bord
router.get('/kpi', verifierToken,
  autoriserRoles('admin', 'responsable'),
  async (req, res) => {
    try {
      // Tickets ouverts (non resolus)
      const ouverts = await Ticket.count({
        where: { statut: { [Op.ne]: 'resolu' } }
      });

      // Tickets resolus
      const resolus = await Ticket.count({
        where: { statut: 'resolu' }
      });

      // Temps moyen de resolution (en minutes)
      const ticketsResolus = await Ticket.findAll({
        where: {
          statut: 'resolu',
          duree_resolution_min: { [Op.ne]: null }
        },
        attributes: ['duree_resolution_min'],
      });

      const tempsMoyen = ticketsResolus.length > 0
        ? Math.round(
            ticketsResolus.reduce((acc, t) => acc + t.duree_resolution_min, 0)
            / ticketsResolus.length
          )
        : 0;

      // Tickets critiques non assignes
      const critiquesNonAssignes = await Ticket.count({
        where: {
          priorite:   'critique',
          assigne_id: null,
          statut:     { [Op.ne]: 'resolu' }
        }
      });

      // Tickets bloques
      const bloques = await Ticket.count({
        where: { statut: 'bloque' }
      });

      res.json({
        status: 'success',
        data: {
          tickets_ouverts:              ouverts,
          tickets_resolus:              resolus,
          temps_moyen_resolution_min:   tempsMoyen,
          critiques_non_assignes:       critiquesNonAssignes,
          tickets_bloques:              bloques,
        }
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

module.exports = router;