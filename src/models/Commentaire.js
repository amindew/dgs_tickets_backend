const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const Commentaire = sequelize.define('Commentaire', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticket_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    auteur_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    contenu: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    cree_le: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    reponse_a_id: {
  type: DataTypes.UUID,
  allowNull: true
  },
    supprime: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    supprime_par: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  });
  Commentaire.associate = (models) => {
    Commentaire.belongsTo(models.Ticket, { foreignKey: 'ticket_id' });
    Commentaire.belongsTo(models.User,   {
      foreignKey: 'auteur_id', as: 'auteur'
    });
  // Auto-référence pour les réponses
    Commentaire.belongsTo(models.Commentaire, { foreignKey: 'reponse_a_id', as: 'reponse_a' });
    Commentaire.hasMany(models.Commentaire,   { foreignKey: 'reponse_a_id', as: 'reponses' });
    Commentaire.belongsTo(models.User,   {
      foreignKey: 'supprime_par', as: 'suppresseur'
    });
  };
  return Commentaire;
};
