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

    type: {
      type: DataTypes.ENUM(
        'statut_change',
        'assignation',
        'commentaire',
        'piece_jointe'
      ),
      allowNull: false,
    },

    titre: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    lue: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },

  }, {
    tableName: 'Notifications',
    timestamps: true,
  });


  Notification.associate = (models) => {
    Notification.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'destinataire'
    });

    Notification.belongsTo(models.Ticket, {
      foreignKey: 'ticket_id',
      as: 'ticket'
    });
  };


  return Notification;
};