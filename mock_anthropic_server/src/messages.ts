import { Request, Response } from 'express';

type Extraction = {
  meetings: Array<{
    date: string;
    title: string;
    startTime?: string;
    endTime?: string;
    location?: string;
  }>;
};

type Plan = {
  days: Array<{
    date: string;
    commuteMode?: string;
    blocks: Array<{
      startTime: string;
      endTime: string;
      title: string;
      type: string;
      details?: string;
    }>;
  }>;
};

function defaultExtraction(): Extraction {
  return { meetings: [] };
}

function defaultPlan(): Plan {
  return { days: [] };
}

let extraction: Extraction = defaultExtraction();
let plan: Plan = defaultPlan();

// Mimics POST /anthropic/v1/messages. Returns the canned extraction payload when
// the request carries an image block (vision), otherwise the canned plan payload.
export function createMessage(req: Request, res: Response) {
  const messages = req.body?.messages ?? [];
  const content = messages[0]?.content ?? [];
  const hasImage =
    Array.isArray(content) && content.some((block: any) => block?.type === 'image');
  const payload = hasImage ? extraction : plan;

  res.json({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'mock-claude',
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    stop_reason: 'end_turn',
  });
}

export function setExtraction(req: Request, res: Response) {
  extraction = req.body;
  res.json({ status: 'ok' });
}

export function setPlan(req: Request, res: Response) {
  plan = req.body;
  res.json({ status: 'ok' });
}

export function reset(_req: Request, res: Response) {
  extraction = defaultExtraction();
  plan = defaultPlan();
  res.json({ status: 'ok' });
}
