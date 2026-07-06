import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const envFile = process.env.ENV === 'prod' ? '.env.prod' : '.dev.vars';
dotenv.config({ path: envFile });

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
