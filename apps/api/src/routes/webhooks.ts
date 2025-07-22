import express, { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../middleware/errorHandlers';

const router = express.Router();

// Webhook routes for external services
router.post('/stripe', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement Stripe webhook handler
  successResponse(res, null, 'Stripe webhook endpoint - to be implemented');
}));

router.post('/zoom', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement Zoom webhook handler
  successResponse(res, null, 'Zoom webhook endpoint - to be implemented');
}));

export default router; 