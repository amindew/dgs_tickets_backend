const jwt = require('jsonwebtoken');

// ─── MIDDLEWARE 1 : Vérifier que le token JWT est valide ───
const verifierToken = (req, res, next) => {

  // Récupérer le header "Authorization"
  const authHeader = req.headers['authorization'];

  // Extraire le token (format : "Bearer TOKEN")
  const token = authHeader && authHeader.split(' ')[1];

  // Si pas de token → refuser l'accès
  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Accès refusé : token manquant'
    });
  }

  // Vérifier que le token est valide
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        status: 'error',
        message: 'Token invalide ou expiré'
      });
    }

    // Token OK → attacher les infos utilisateur à la requête
    req.user = decoded; // contient : { id, role, nom }
    next();
  });
};

// ─── MIDDLEWARE 2 : Vérifier que l'utilisateur a le bon rôle ───
const autoriserRoles = (...rolesAutorises) => {
  return (req, res, next) => {

    if (!rolesAutorises.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Accès refusé : droits insuffisants'
      });
    }

    next();
  };
};

// ─── EXPORTER les deux middlewares ───
module.exports = { verifierToken, autoriserRoles };