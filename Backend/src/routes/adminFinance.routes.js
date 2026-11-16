import express from 'express';
import { verifyAdmin } from '../middleware/adminAuth.middleware.js';
import upload, { handleMulterError } from '../middleware/multer.js';
import {
  getPartners,
  createPartner,
  updatePartner,
  getFinanceEntries,
  createFinanceEntry,
  updateFinanceEntry,
  deleteFinanceEntry,
  toggleSplitSettlement,
  getFinanceOverview,
} from '../controllers/adminControllers/finance.controllers.js';

const router = express.Router();

// Apply admin verification middleware to all finance routes
router.use(verifyAdmin);

// Partner routes
router.get('/partners', getPartners);
router.post('/partners', createPartner);
router.put('/partners/:id', updatePartner);

// Finance Overview / Analytics
router.get('/overview', getFinanceOverview);

// Finance Entries (Income / Expenses) with optional receipt file upload
router.get('/entries', getFinanceEntries);
router.post('/entries', upload.single('receipt'), handleMulterError, createFinanceEntry);
router.put('/entries/:id', upload.single('receipt'), handleMulterError, updateFinanceEntry);
router.delete('/entries/:id', deleteFinanceEntry);

// Settlement status toggle
router.patch('/entries/:entryId/splits/:splitId/settle', toggleSplitSettlement);

export default router;

