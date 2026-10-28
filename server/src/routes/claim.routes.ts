import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { claimLimiter } from '../middleware/rateLimits';
import { validateBody } from '../validation/validate';
import { createClaimSchema } from '../validation/schemas';
import { createClaim, getIncomingClaims, getMyClaims, approveClaim, rejectClaim } from '../controllers/claim.controller';

const router = Router();

router.post('/',                       requireAuth, claimLimiter, validateBody(createClaimSchema), createClaim);
router.get('/incoming',                requireAuth, getIncomingClaims);
router.get('/my',                      requireAuth, getMyClaims);
router.patch('/:claimId/approve',      requireAuth, approveClaim);
router.patch('/:claimId/reject',       requireAuth, rejectClaim);

export default router;