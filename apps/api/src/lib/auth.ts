import { expo } from '@better-auth/expo';
import { createDb } from '@repo/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Bindings } from '../types';

export function createAuth(env: Bindings) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(createDb(env.DATABASE_URL), { provider: 'pg' }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    trustedOrigins: ['exp://', 'http://localhost:8081', 'https://know-your-meals.pages.dev'],
    plugins: [expo()],
    account: {
      // ponytail: pages.dev→API のクロスオリジン fetch で SameSite=Lax の state cookie が保存されないため
      skipStateCookieCheck: true,
    },
  });
}
