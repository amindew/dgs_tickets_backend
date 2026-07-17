module.exports = {
  up: async (queryInterface) => {
    const colonnes = await queryInterface.describeTable('Tickets');
    if (colonnes.email_client && !colonnes.client_email) {
      await queryInterface.renameColumn('Tickets', 'email_client', 'client_email');
    }
    if (colonnes.telephone_client && !colonnes.client_telephone) {
      await queryInterface.renameColumn('Tickets', 'telephone_client', 'client_telephone');
    }
  },
  down: async (queryInterface) => {
    const colonnes = await queryInterface.describeTable('Tickets');
    if (colonnes.client_email && !colonnes.email_client) {
      await queryInterface.renameColumn('Tickets', 'client_email', 'email_client');
    }
    if (colonnes.client_telephone && !colonnes.telephone_client) {
      await queryInterface.renameColumn('Tickets', 'client_telephone', 'telephone_client');
    }
  },
};
