const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const HistoriqueStatut = sequelize.define('HistoriqueStatut', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticket_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ancien_statut: {
      type: DataTypes.ENUM('a_faire','en_cours','bloque','resolu'),
      allowNull: false,
    },
    nouveau_statut: {
      type: DataTypes.ENUM('a_faire','en_cours','bloque','resolu'),
      allowNull: false,
    },
    modifie_par: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    modifie_le: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  });
  HistoriqueStatut.associate = (models) => {
HistoriqueStatut.belongsTo(models.Ticket, { foreignKey: 'ticket_id' });
    HistoriqueStatut.belongsTo(models.User,   {
      foreignKey: 'modifie_par', as: 'modificateur'
    });
  };
  return HistoriqueStatut;
};