const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const PieceJointe = sequelize.define('PieceJointe', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticket_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nom_fichier: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    taille_ko: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  });
  PieceJointe.associate = (models) => {
    PieceJointe.belongsTo(models.Ticket, { foreignKey: 'ticket_id' });
  };
  return PieceJointe;
};