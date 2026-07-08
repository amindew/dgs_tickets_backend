require('dotenv').config();
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { User } = require('../models');
const { verifierToken, autoriserRoles } = require('../middlewares/auth');

// ─── Helper : envoyer email via Resend ───────────────────────────────────────
async function envoyerEmail({ to, subject, html }) {
  const destinataire = to;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'DGS Tickets <noreply@dgsafrica.com>',
      to: destinataire,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Resend error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Email ou mot de passe incorrect' });
    }

    const valide = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!valide) {
      return res.status(401).json({ status: 'error', message: 'Email ou mot de passe incorrect' });
    }

    if (!user.actif) {
      return res.status(403).json({ status: 'error', message: 'Compte désactivé, contactez votre administrateur' });
    }

    if (user.invitation_en_attente === true) {
      return res.status(403).json({
        status: 'error',
        message: 'Vous devez d\'abord définir votre mot de passe via le lien reçu par email'
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, nom: user.nom },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      status: 'success',
      message: 'Connexion réussie',
      data: { token, role: user.role, nom: user.nom, id: user.id }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─── POST /auth/inviter ───────────────────────────────────────────────────────
router.post('/inviter', verifierToken, autoriserRoles('admin'), async (req, res) => {
  try {
    const { nom, email, role } = req.body;

    if (!nom || !email || !role) {
      return res.status(400).json({ status: 'error', message: 'nom, email et role sont obligatoires' });
    }

    const existant = await User.findOne({ where: { email } });
    if (existant) {
      return res.status(400).json({ status: 'error', message: 'Un compte avec cet email existe déjà' });
    }

    const tokenInvitation = crypto.randomBytes(32).toString('hex');
    const motDePasseTemp  = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

    const user = await User.create({
      nom, email, role,
      mot_de_passe: motDePasseTemp,
      invitation_token: tokenInvitation,
      invitation_en_attente: true,
      actif: true,
    });

    const lien = `${process.env.FRONTEND_URL}/definir-mot-de-passe/${tokenInvitation}`;

    await envoyerEmail({
      to: email,
      subject: 'Bienvenue sur DGS Tickets — Définissez votre mot de passe',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #0f172a;">Bienvenue sur DGS Tickets, ${nom} 👋</h2>
          <p style="color: #475569;">Votre compte a été créé avec le rôle <strong>${role}</strong>.</p>
          <p style="color: #475569;">Cliquez sur le bouton ci-dessous pour définir votre mot de passe :</p>
          <a href="${lien}" style="
            display: inline-block; margin: 24px 0; padding: 12px 24px;
            background: #f97316; color: white; text-decoration: none;
            border-radius: 8px; font-weight: bold;
          ">Définir mon mot de passe</a>
          <p style="color: #94a3b8; font-size: 12px;">Ce lien expire dans 24 heures.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #94a3b8; font-size: 12px;">DGS Africa — Direction Technique</p>
        </div>
      `
    });

    res.status(201).json({
      status: 'success',
      message: `Invitation envoyée à ${email}`,
      data: { id: user.id, nom: user.nom, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─── POST /auth/definir-mot-de-passe/:token ───────────────────────────────────
router.post('/definir-mot-de-passe/:token', async (req, res) => {
  try {
    const { mot_de_passe } = req.body;
    const { token } = req.params;

    if (!mot_de_passe || mot_de_passe.length < 8) {
      return res.status(400).json({ status: 'error', message: 'Le mot de passe doit faire au moins 8 caractères' });
    }

    const user = await User.findOne({ where: { invitation_token: token } });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Lien invalide ou expiré' });
    }

    user.mot_de_passe          = await bcrypt.hash(mot_de_passe, 10);
    user.invitation_token      = null;
    user.invitation_en_attente = false;
    await user.save();

    res.json({ status: 'success', message: 'Mot de passe défini. Vous pouvez maintenant vous connecter.' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─── GET /auth ────────────────────────────────────────────────────────────────
router.get('/', verifierToken, autoriserRoles('admin'), async (req, res) => {
  try {
    const users = await User.findAll({ attributes: ['id', 'nom', 'email', 'role'] });
    res.json({ status: 'success', data: users });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});



module.exports = router;