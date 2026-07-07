// ajouter-colonne.js
const { sequelize } = require('./models');

async function main() {
  await sequelize.query(`
    ALTER TABLE "Tickets" 
    ADD COLUMN IF NOT EXISTS "date_limite_resolution" TIMESTAMP WITH TIME ZONE;
  `);
  console.log('✅ Colonne ajoutée');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });