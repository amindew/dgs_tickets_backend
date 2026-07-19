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
      // Un responsable ne voit que les statistiques de ses propres tickets
      // crees ; seul l'admin a une visibilite totale (meme regle que la
      // liste des tickets).
      const filtreBaseRole = req.user.role === 'responsable'
        ? { cree_par: req.user.id }
        : {};

      // Les tickets supprimes (suppression douce) ne comptent pas dans les
      // statistiques normales, ils ont leur propre compteur dedie.
      const filtreRole = { ...filtreBaseRole, supprime: { [Op.not]: true } };

      const total = await Ticket.count({ where: filtreRole });
      const ouverts = await Ticket.count({
        where: { ...filtreRole, statut: { [Op.ne]: 'resolu' } }
      });
      const resolus = await Ticket.count({
        where: { ...filtreRole, statut: 'resolu' }
      });
      const bloques = await Ticket.count({
        where: { ...filtreRole, statut: 'bloque' }
      });
      const critiquesNonAssignes = await Ticket.count({
        where: {
          ...filtreRole,
          priorite:   'critique',
          assigne_id: null,
          statut:     { [Op.ne]: 'resolu' }
        }
      });
      // Temps moyen de resolution en minutes
      const ticketsResolus = await Ticket.findAll({
        where: {
          ...filtreRole,
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
        where: filtreRole,
        attributes: ['priorite', [fn('COUNT', col('id')), 'total']],
        group: ['priorite'],
      });
      // Stats par statut
      const parStatut = await Ticket.findAll({
        where: filtreRole,
        attributes: ['statut', [fn('COUNT', col('id')), 'total']],
        group: ['statut'],
      });
      // Taux de resolution
      const tauxResolution = total > 0
        ? Math.round((resolus / total) * 100)
        : 0;

      const ticketsSupprimes = await Ticket.count({
        where: { ...filtreBaseRole, supprime: true }
      });

      res.json({
        status: 'success',
        data: {
          total,
          tickets_ouverts:              ouverts,
          tickets_resolus:              resolus,
          tickets_bloques:              bloques,
          critiques_non_assignes:       critiquesNonAssignes,
          tickets_supprimes:            ticketsSupprimes,
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
