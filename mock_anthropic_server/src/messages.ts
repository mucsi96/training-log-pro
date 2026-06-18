import { Request, Response } from 'express';

// A deterministic learning path returned for an initial generation request.
const BASE_PATH = {
  summary: 'A practical path to get you started.',
  topics: [
    {
      title: 'Getting started',
      blocks: [
        {
          type: 'video',
          title: 'Intro video',
          description: 'Watch the overview.',
          url: 'https://example.com/intro',
        },
        {
          type: 'article',
          title: 'Core concepts article',
          description: 'Read the basics.',
        },
      ],
    },
    {
      title: 'Hands-on practice',
      blocks: [
        {
          type: 'practice',
          title: 'First exercise',
          description: 'Do the exercise.',
        },
      ],
    },
  ],
};

// Returned when the request asks to make the path more "advanced",
// so a refinement (iterate-with-AI) step produces a visibly different path.
const ADVANCED_PATH = {
  summary: 'A deeper path with advanced material.',
  topics: [
    {
      title: 'Getting started',
      blocks: [
        {
          type: 'video',
          title: 'Intro video',
          description: 'Watch the overview.',
          url: 'https://example.com/intro',
        },
      ],
    },
    {
      title: 'Advanced techniques',
      blocks: [
        {
          type: 'course',
          title: 'Advanced course',
          description: 'Take the deep dive.',
        },
      ],
    },
  ],
};

function collectText(body: any): string {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  return messages
    .map((message: any) => {
      if (typeof message?.content === 'string') {
        return message.content;
      }
      if (Array.isArray(message?.content)) {
        return message.content
          .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
          .join(' ');
      }
      return '';
    })
    .join(' ');
}

export function createMessage(req: Request, res: Response) {
  const text = collectText(req.body).toLowerCase();
  const path = text.includes('advanced') ? ADVANCED_PATH : BASE_PATH;

  console.log('[createMessage] returning', text.includes('advanced') ? 'ADVANCED_PATH' : 'BASE_PATH');

  res.json({
    id: 'msg_mock',
    type: 'message',
    role: 'assistant',
    model: req.body?.model ?? 'claude-opus-4-8',
    content: [{ type: 'text', text: JSON.stringify(path) }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 100 },
  });
}
