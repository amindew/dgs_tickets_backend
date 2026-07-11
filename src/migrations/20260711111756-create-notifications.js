'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Notifications', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },

      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },

      ticket_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Tickets',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },

      titre: {
        type: Sequelize.STRING,
        allowNull: false
      },

      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },

      type: {
        type: Sequelize.STRING,
        allowNull: false
      },

      lu: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },

      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Notifications');
  }
};