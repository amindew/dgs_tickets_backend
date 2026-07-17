'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.createTable('Notifications', {

      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false
      },

      // Propriétaire de la notification
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      // Ticket concerné (optionnel)
      ticket_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Tickets',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      titre: {
        type: Sequelize.STRING(255),
        allowNull: false
      },

      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },

      // Exemple :
      // ticket_assigne
      // nouveau_commentaire
      // changement_statut
      // piece_jointe
      type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      // Permet d'afficher les notifications non lues
      lue: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }

    });


    // Index pour récupérer rapidement les notifications d'un utilisateur
    await queryInterface.addIndex(
      'Notifications',
      ['user_id', 'lue']
    );

  },


  async down(queryInterface) {

    await queryInterface.dropTable('Notifications');

  }
};