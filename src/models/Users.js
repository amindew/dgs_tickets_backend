const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
const User = sequelize.define('User', {
id: {
type: DataTypes.UUID,
defaultValue: DataTypes.UUIDV4,
primaryKey: true,
},
nom: { 
type: DataTypes.STRING,
allowNull: false,
},
email: {
type: DataTypes.STRING,
unique: true,
allowNull: false,
validate: { isEmail: true },
},
mot_de_passe: {
type: DataTypes.STRING,
allowNull: false,
},
role: {
type: DataTypes.ENUM('admin', 'responsable', 'technicien'),
allowNull: false,
},
actif: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: true,
},
invitation_token: { type: DataTypes.STRING, allowNull: true },
invitation_en_attente: { type: DataTypes.BOOLEAN, defaultValue: false },
invitation_token: { type: DataTypes.STRING, allowNull: true },
invitation_en_attente: { type: DataTypes.BOOLEAN, defaultValue: false },
photo_url: { type: DataTypes.STRING, allowNull: true },
});

// A la fin du fichier User.js, avant return User
User.associate = (models) => {
  User.hasMany(models.Ticket, { foreignKey: 'cree_par',  as: 'ticketsCrees' });
  User.hasMany(models.Ticket, { foreignKey: 'assigne_id', as: 'ticketsAssignes' });
};

return User;
};
