'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Tickets"
      ADD COLUMN IF NOT EXISTS "date_limite_resolution" TIMESTAMP WITH TIME ZONE;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Tickets"
      DROP COLUMN IF EXISTS "date_limite_resolution";
    `);
  }
};