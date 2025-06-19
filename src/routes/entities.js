const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validateCreateEntity } = require('../middleware/validation');
const entityController = require('../controllers/entityController');

const router = express.Router();

// Entity routes
router.post('/create-entity/', authenticateToken, validateCreateEntity, entityController.createEntity);
router.get('/entities/:entity_uuid/', authenticateToken, entityController.getEntity);
router.get('/list-entities/', authenticateToken, entityController.listEntities);
router.put('/entities/:entity_uuid/', authenticateToken, validateCreateEntity, entityController.updateEntity);
router.delete('/entities/:entity_uuid/', authenticateToken, entityController.deleteEntity);
router.get('/entities/:entity_uuid/stats/', authenticateToken, entityController.getEntityStats);

module.exports = router;