const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Ticket = sequelize.define('Ticket', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    reference: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },

    titre: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    priorite: {
      type: DataTypes.ENUM('basse', 'moyenne', 'critique'),
      allowNull: false,
      defaultValue: 'moyenne',
    },

    statut: {
      type: DataTypes.ENUM('a_faire', 'en_cours', 'bloque', 'resolu'),
      allowNull: false,
      defaultValue: 'a_faire',
    },

    client_nom: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    client_email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },

    client_telephone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        is: /^(\+221|00221)?(70|75|76|77|78)[0-9]{7}$/,
      },
    },

    assigne_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    cree_par: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    ouvert_le: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    resolu_le: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    duree_resolution_min: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    //  Nouvelle colonne : délai de résolution (date limite)
    date_limite_resolution: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  // Associations
  Ticket.associate = (models) => {
    Ticket.belongsTo(models.User, {
      foreignKey: 'cree_par',
      as: 'createur',
    });

    Ticket.belongsTo(models.User, {
      foreignKey: 'assigne_id',
      as: 'assigne',
    });

Ticket.hasMany(models.Notification, {
  foreignKey: 'ticket_id',
  as: 'notifications',
});

  };

  return Ticket;
};