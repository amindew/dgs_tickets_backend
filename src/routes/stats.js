const express    = require('express');
const router     = express.Router();
const { Ticket } = require('../models');
const { verifierToken, autoriserRoles } = require('../middlewares/auth');
const { Op, fn, col, literal } = require('sequelize');
// GET /stats/kpi
router.get('/kpi', verifierToken,
  autoriserRoles('admin', 'responsable'),
  async (req, res) => {
    try {
      const total = await Ticket.count();
      const ouverts = await Ticket.count({
        where: { statut: { [Op.ne]: 'resolu' } }
      });
      const resolus = await Ticket.count({
        where: { statut: 'resolu' }
      });
      const bloques = await Ticket.count({
        where: { statut: 'bloque' }
      });
      const critiquesNonAssignes = await Ticket.count({
        where: {
          priorite:   'critique',
          assigne_id: null,
          statut:     { [Op.ne]: 'resolu' }
        }
      });
      // Temps moyen de resolution en minutes
      const ticketsResolus = await Ticket.findAll({
        where: {
          statut: 'resolu',
          duree_resolution_min: { [Op.ne]: null }
        },
        attributes: ['duree_resolution_min'],
      });
       const tempsMoyenMin = ticketsResolus.length > 0
        ? Math.round(
            ticketsResolus.reduce((acc, t) => acc + t.duree_resolution_min, 0)
            / ticketsResolus.length
          )
        : 0;
      // Stats par priorite
      const parPriorite = await Ticket.findAll({
        attributes: ['priorite', [fn('COUNT', col('id')), 'total']],
        group: ['priorite'],
      });
      // Stats par statut
      const parStatut = await Ticket.findAll({
        attributes: ['statut', [fn('COUNT', col('id')), 'total']],
        group: ['statut'],
      });
      // Taux de resolution
      const tauxResolution = total > 0
        ? Math.round((resolus / total) * 100)
        : 0;
      res.json({
        status: 'success',
        data: {
          total,
          tickets_ouverts:              ouverts,
          tickets_resolus:              resolus,
          tickets_bloques:              bloques,
          critiques_non_assignes:       critiquesNonAssignes,
          temps_moyen_resolution_min:   tempsMoyenMin,
          taux_resolution_pct:          tauxResolution,
          par_priorite:                 parPriorite,
          par_statut:                   parStatut,
        }
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);
module.exports = router;
