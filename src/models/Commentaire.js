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
  });
  Commentaire.associate = (models) => {
    Commentaire.belongsTo(models.Ticket, { foreignKey: 'ticket_id' });
    Commentaire.belongsTo(models.User,   {
      foreignKey: 'auteur_id', as: 'auteur'
    });
  };
  return Commentaire;
};
