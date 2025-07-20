import express from 'express';
import { asyncHandler, successResponse } from '../middleware/errorHandlers';

const router = express.Router();

// Webhook routes for external services
router.post('/stripe', asyncHandler(async (req, res) => {
  // TODO: Implement Stripe webhook handler
  successResponse(res, null, 'Stripe webhook endpoint - to be implemented');
}));

router.post('/zoom', asyncHandler(async (req, res) => {
  // TODO: Implement Zoom webhook handler
  successResponse(res, null, 'Zoom webhook endpoint - to be implemented');
}));

export default router; 