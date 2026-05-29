const { z } = require('zod');

const CreateBreakdownSchema = z.object({
  asset_id: z.string().uuid(),
  description: z.string().min(1),
  description_ta: z.string().optional(),
  severity: z.enum(['minor', 'normal', 'major', 'line_down']).default('normal'),
  category: z.enum(['mechanical', 'electrical', 'hydraulic', 'software', 'operator_error', 'unknown']).optional(),
  started_at: z.string().datetime().optional(),
  photos: z.array(z.string().url()).optional().default([]),
  documents: z.array(z.string().url()).optional().default([]),
});

const testData = {
  asset_id: 'a0000000-0000-0000-0000-000000000001',
  description: 'Motor malfunction',
  severity: 'major',
  category: 'mechanical',
};

const result = CreateBreakdownSchema.safeParse(testData);
console.log('Result:', JSON.stringify(result, null, 2));
