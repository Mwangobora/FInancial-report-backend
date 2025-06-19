// scripts/setup-database.js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'financial_reporting',
  password: process.env.DB_PASSWORD || '200212',
  port: process.env.DB_PORT || 5432,
});

async function setupDatabase() {
  try {
    console.log('🔧 Setting up database...');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'src/config/database_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute SQL
    await pool.query(sql);
    
    console.log('✅ Database setup completed successfully!');
    console.log('📊 Tables created:');
    console.log('   - users');
    console.log('   - entities');
    console.log('   - ledgers');
    console.log('   - accounts');
    console.log('   - transactions');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();