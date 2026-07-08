import express from 'express';
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  addLeadLog,
  deleteLead,
  getSalesRepresentatives
} from '../../controllers/adminControllers/lead.controllers.js';

const router = express.Router();

router.post('/', createLead);
router.get('/', getLeads);
router.get('/staff', getSalesRepresentatives);
router.get('/:id', getLeadById);
router.put('/:id', updateLead);
router.post('/:id/logs', addLeadLog);
router.delete('/:id', deleteLead);

export default router;
