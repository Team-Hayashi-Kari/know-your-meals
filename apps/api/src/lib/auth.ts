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
    trustedOrigins: [
      'exp://',
      'http://localhost:8081',
      'https://know-your-meals.pages.dev',
      'https://know-your-meals.com',
      'https://www.know-your-meals.com',
    ],
    plugins: [expo()],
    advanced: {
      // 本番はpages.dev↔APIがクロスサイトなのでSameSite=None+Secure。
      // ローカルはlocalhost同士でSameSite不要、かつSecure必須のNoneはHTTPで弾かれるためLax。
      defaultCookieAttributes: env.BETTER_AUTH_URL.startsWith('https://') ? { sameSite: 'none', secure: true } : { sameSite: 'lax', secure: false },
    },
  });
}
