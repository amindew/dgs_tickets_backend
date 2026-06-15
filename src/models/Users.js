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
});
return User;
};
