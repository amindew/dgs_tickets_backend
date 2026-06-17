'use strict';
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Trouver et supprimer la contrainte unique sur email_client
    const [constraints] = await queryInterface.sequelize.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = '"Tickets"'::regclass
      AND contype = 'u'
      AND conname LIKE '%email_client%';
    `);

    for (const c of constraints) {
      await queryInterface.sequelize.query(`ALTER TABLE "Tickets" DROP CONSTRAINT "${c.conname}";`);
    }

    // Renommer les colonnes pour matcher le modele
    await queryInterface.renameColumn('Tickets', 'email_client', 'client_email');
    await queryInterface.renameColumn('Tickets', 'telephone_client', 'client_telephone');

    // Rendre le telephone optionnel (comme dans le modele)
    await queryInterface.changeColumn('Tickets', 'client_telephone', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn('Tickets', 'client_email', 'email_client');
    await queryInterface.renameColumn('Tickets', 'client_telephone', 'telephone_client');
    await queryInterface.changeColumn('Tickets', 'telephone_client', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
