import { expo } from '@better-auth/expo';
import { createDb } from '@repo/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Bindings } from '../types';

export function createAuth(env: Bindings) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    database: drizzleAdapter(createDb(env.DATABASE_URL), { provider: 'pg' }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    trustedOrigins: ['exp://', 'http://localhost:8081', 'https://know-your-meals.pages.dev'],
    plugins: [expo()],
    advanced: {
      // ponytail: pages.dev↔API はクロスサイトのため SameSite=None が必要（state/session_token 両方）
      defaultCookieAttributes: { sameSite: 'none', secure: true },
    },
  });
}
