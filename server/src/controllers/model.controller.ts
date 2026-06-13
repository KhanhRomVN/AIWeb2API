import { Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import {
  findAllModelSequences,
  upsertModelSequence as upsertModelSequenceRepo,
  shiftSequencesUp,
  normalizeSequences,
  deleteModelSequence as deleteModelSequenceRow,
} from '../repositories/model-sequence.repository';

const logger = createLogger('ModelController');

export const getModelSequences = async (req: Request, res: Response): Promise<void> => {
  try {
    const sequences = findAllModelSequences();
    res.json({ success: true, data: sequences });
  } catch (error: any) {
    logger.error('Error fetching model sequences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch model sequences',
      error: { code: 'INTERNAL_SERVER_ERROR', details: error.message },
    });
  }
};

export const upsertModelSequenceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider_id, model_id, sequence } = req.body;
    if (!provider_id || !model_id || sequence === undefined) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    upsertModelSequenceRepo(provider_id, model_id, sequence, Date.now());
    res.json({ success: true, message: 'Sequence updated' });
  } catch (error: any) {
    logger.error('Error upserting model sequence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update model sequence',
      error: { code: 'INTERNAL_SERVER_ERROR', details: error.message },
    });
  }
};

export const insertModelSequenceController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider_id, model_id, sequence } = req.body;
    if (!provider_id || !model_id || sequence === undefined) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    shiftSequencesUp(sequence);
    upsertModelSequenceRepo(provider_id, model_id, sequence, Date.now());
    normalizeSequences();

    res.json({ success: true, message: 'Sequence inserted and reordered' });
  } catch (error: any) {
    logger.error('Error inserting model sequence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to insert model sequence',
      error: { code: 'INTERNAL_SERVER_ERROR', details: error.message },
    });
  }
};

export const deleteModelSequence = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, modelId } = req.params;
    deleteModelSequenceRow(providerId, modelId);
    res.json({ success: true, message: 'Sequence removed' });
  } catch (error: any) {
    logger.error('Error deleting model sequence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete model sequence',
      error: { code: 'INTERNAL_SERVER_ERROR', details: error.message },
    });
  }
};

// Backward-compatible alias
export const upsertModelSequence = upsertModelSequenceController;
export const insertModelSequence = insertModelSequenceController;
