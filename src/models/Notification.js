const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

  const Notification = sequelize.define('Notification', {

    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    ticket_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    titre: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    lu: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    }

  });

  Notification.associate = (models) => {

    Notification.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'utilisateur'
    });

    Notification.belongsTo(models.Ticket, {
      foreignKey: 'ticket_id',
      as: 'ticket'
    });

  };

  return Notification;
};