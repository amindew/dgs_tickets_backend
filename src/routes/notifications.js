const express = require('express');
const router  = express.Router();
const { Notification, Ticket } = require('../models');
const { verifierToken } = require('../middlewares/auth');

// GET /notifications — Récupérer les notifications de l'utilisateur connecté
router.get('/', verifierToken, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      include: [{
        model: Ticket,
        as: 'ticket',
        attributes: ['id', 'reference', 'titre'],
      }],
      order: [['createdAt', 'DESC']],
      limit: 50, // les 50 dernières
    });

    res.json({ status: 'success', data: notifications });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PATCH /notifications/:id/lue — Marquer une notification comme lue
router.patch('/:id/lue', verifierToken, async (req, res) => {
  try {
    const notif = await Notification.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });

    if (!notif) {
      return res.status(404).json({
        status: 'error', message: 'Notification non trouvée'
      });
    }

    notif.lue = true;
    await notif.save();

    res.json({ status: 'success', message: 'Notification marquée comme lue' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// PATCH /notifications/tout-lire — Marquer toutes comme lues
router.patch('/tout-lire', verifierToken, async (req, res) => {
  try {
    await Notification.update(
      { lue: true },
      { where: { user_id: req.user.id, lue: false } }
    );

    res.json({
      status: 'success',
      message: 'Toutes les notifications marquées comme lues'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;