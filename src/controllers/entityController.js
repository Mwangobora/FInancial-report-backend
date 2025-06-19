const pool = require('../config/database');

const entityController = {
  // Create new entity
  createEntity: async (req, res) => {
    try {
      const {
        name, address_1, address_2, path, depth, admin, city, state,
        zip_code, country, email, website, phone, hidden, accrual_method,
        fy_start_month, last_closing_date, meta, managers
      } = req.body;

      const result = await pool.query(
        `INSERT INTO entities (
          name, address_1, address_2, path, depth, admin, city, state,
          zip_code, country, email, website, phone, hidden, accrual_method,
          fy_start_month, last_closing_date, meta, managers, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *`,
        [
          name, address_1, address_2, path, depth, admin, city, state,
          zip_code, country, email, website, phone, hidden, accrual_method,
          fy_start_month, last_closing_date, JSON.stringify(meta), JSON.stringify(managers), req.user.id
        ]
      );

      const entity = result.rows[0];
      res.status(201).json(entity);
    } catch (error) {
      console.error('Create entity error:', error);
      if (error.code === '23505') { // Unique violation
        res.status(400).json({ error: 'Entity with this path already exists' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  },

  // Get entity by UUID
  getEntity: async (req, res) => {
    try {
      const { entity_uuid } = req.params;

      const result = await pool.query(
        'SELECT * FROM entities WHERE uuid = $1 AND user_id = $2',
        [entity_uuid, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get entity error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // List all entities for user
  listEntities: async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM entities WHERE user_id = $1 ORDER BY created_at DESC',
        [req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('List entities error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Update entity
  updateEntity: async (req, res) => {
    try {
      const { entity_uuid } = req.params;
      const {
        name, address_1, address_2, path, depth, admin, city, state,
        zip_code, country, email, website, phone, hidden, accrual_method,
        fy_start_month, last_closing_date, meta, managers
      } = req.body;

      const result = await pool.query(
        `UPDATE entities SET 
          name = $1, address_1 = $2, address_2 = $3, path = $4, depth = $5,
          admin = $6, city = $7, state = $8, zip_code = $9, country = $10,
          email = $11, website = $12, phone = $13, hidden = $14, accrual_method = $15,
          fy_start_month = $16, last_closing_date = $17, meta = $18, managers = $19,
          updated_at = CURRENT_TIMESTAMP
        WHERE uuid = $20 AND user_id = $21
        RETURNING *`,
        [
          name, address_1, address_2, path, depth, admin, city, state,
          zip_code, country, email, website, phone, hidden, accrual_method,
          fy_start_month, last_closing_date, JSON.stringify(meta), JSON.stringify(managers),
          entity_uuid, req.user.id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update entity error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Delete entity
  deleteEntity: async (req, res) => {
    try {
      const { entity_uuid } = req.params;

      const result = await pool.query(
        'DELETE FROM entities WHERE uuid = $1 AND user_id = $2 RETURNING uuid',
        [entity_uuid, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      res.json({ 
        message: 'Entity deleted successfully', 
        uuid: result.rows[0].uuid 
      });
    } catch (error) {
      console.error('Delete entity error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get entity statistics
  getEntityStats: async (req, res) => {
    try {
      const { entity_uuid } = req.params;

      // Verify entity ownership
      const entityCheck = await pool.query(
        'SELECT uuid FROM entities WHERE uuid = $1 AND user_id = $2',
        [entity_uuid, req.user.id]
      );

      if (entityCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Entity not found' });
      }

      // Get ledger count
      const ledgerCount = await pool.query(
        'SELECT COUNT(*) as count FROM ledgers WHERE entity_uuid = $1',
        [entity_uuid]
      );

      // Get account count
      const accountCount = await pool.query(
        `SELECT COUNT(*) as count FROM accounts a
         JOIN ledgers l ON a.ledger_uuid = l.uuid
         WHERE l.entity_uuid = $1`,
        [entity_uuid]
      );

      // Get transaction count
      const transactionCount = await pool.query(
        `SELECT COUNT(*) as count FROM transactions t
         JOIN accounts a ON t.account_uuid = a.uuid
         JOIN ledgers l ON a.ledger_uuid = l.uuid
         WHERE l.entity_uuid = $1`,
        [entity_uuid]
      );

      res.json({
        entity_uuid,
        ledger_count: parseInt(ledgerCount.rows[0].count),
        account_count: parseInt(accountCount.rows[0].count),
        transaction_count: parseInt(transactionCount.rows[0].count)
      });
    } catch (error) {
      console.error('Get entity stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = entityController;