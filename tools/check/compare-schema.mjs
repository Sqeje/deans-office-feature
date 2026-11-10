import { readFileSync } from 'node:fs';
import { normalizeSchema } from './schema-text.mjs';

const [tracked, generated] = process.argv.slice(2);
if (!tracked || !generated) throw new Error('Provide tracked and generated schema paths');
if (normalizeSchema(readFileSync(tracked, 'utf8')) !== normalizeSchema(readFileSync(generated, 'utf8'))) {
  console.error('OpenAPI types differ. Regenerate frontend/src/shared/schema.d.ts with npm run api:generate and include the result in your change.');
  process.exitCode = 1;
}
