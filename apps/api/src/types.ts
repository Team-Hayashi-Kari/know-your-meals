import type { createAuth } from './lib/auth';

type AuthUser = NonNullable<Awaited<ReturnType<ReturnType<typeof createAuth>['api']['getSession']>>>['user'];

export type Bindings = {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_PLACES_API_KEY: string;
  IMAGES_BUCKET: R2Bucket;
  IMAGES_BASE_URL: string;
};

export type Env = {
  Bindings: Bindings;
  Variables: {
    user: AuthUser;
  };
};
