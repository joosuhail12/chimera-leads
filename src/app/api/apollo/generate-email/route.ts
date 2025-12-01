import { openai } from '@/lib/ai/client';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { template, context, settings } = await req.json();

        if (!process.env.OPENAI_API_KEY) {
            // Fallback for when API key is missing
            return NextResponse.json({
                subject: template?.subject || 'Meeting Request',
                body: `Hi ${context.lead.name},\n\nI noticed ${context.lead.company} is doing great work in ${context.lead.industry}.\n\nWe help companies like yours ${context.product.value_props[0] || 'grow'}.\n\nBest,\n${context.sender.name}`,
                score: 70,
                suggestions: ['Add API key to get better results'],
                personalization: { level: 'low', factors: [] }
            });
        }

        const systemPrompt = `You are an expert sales copywriter. Generate a cold email based on the provided context.
    
    Settings:
    - Creativity: ${settings.creativity}
    - Formality: ${settings.formality}
    - Length: ${settings.length}
    - Include P.S.: ${settings.includePS}
    - Include CTA: ${settings.includeCTA}
    - Use Emojis: ${settings.useEmojis}
    
    Context:
    - Lead: ${JSON.stringify(context.lead)}
    - Sender: ${JSON.stringify(context.sender)}
    - Product: ${JSON.stringify(context.product)}
    - Template: ${JSON.stringify(template)}
    
    Output JSON format:
    {
      "subject": "string",
      "body": "string",
      "score": number (0-100),
      "suggestions": ["string"],
      "personalization": {
        "level": "low" | "medium" | "high",
        "factors": ["string"]
      }
    }`;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Generate the email." }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error('No content generated');

        const result = JSON.parse(content);
        return NextResponse.json(result);

    } catch (error) {
        console.error('Email generation error:', error);
        return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
    }
}
