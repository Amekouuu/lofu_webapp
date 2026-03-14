import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createClaim, getIncomingClaims, getMyClaims, approveClaim, rejectClaim } from '../controllers/claim.controller';

const router = Router();

router.post('/',                       requireAuth, createClaim);
router.get('/incoming',                requireAuth, getIncomingClaims);
router.get('/my',                      requireAuth, getMyClaims);
router.patch('/:claimId/approve',      requireAuth, approveClaim);
router.patch('/:claimId/reject',       requireAuth, rejectClaim);

export default router;