import { getAppUrl } from '@/lib/app-url';

describe('getAppUrl', () => {
  const originalEnvironment = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
  };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
  });

  afterAll(() => {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('keeps localhost as the development fallback', () => {
    expect(getAppUrl()).toBe('http://localhost:3000');
  });

  it('uses the Vercel deployment URL for Preview even when the configured URL is localhost', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_URL = 'atemi-preview-git-feature-atemi.vercel.app';

    expect(getAppUrl()).toBe('https://atemi-preview-git-feature-atemi.vercel.app');
  });

  it('uses the configured public domain for production', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://atemi.com/';
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_URL = 'atemi-production.vercel.app';

    expect(getAppUrl()).toBe('https://atemi.com');
  });

  it('does not use a localhost URL in a Vercel production deployment', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_URL = 'atemi-production.vercel.app';

    expect(getAppUrl()).toBe('https://atemi-production.vercel.app');
  });

  it('fails closed when a Preview has only a localhost URL and no deployment URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.VERCEL_ENV = 'preview';

    expect(() => getAppUrl()).toThrow('VERCEL_URL is required for a Preview deployment');
  });
});
