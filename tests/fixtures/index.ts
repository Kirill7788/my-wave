/**
 * fixtures/index.ts
 * Расширяет стандартные фикстуры Playwright.
 *
 * Доступные фикстуры:
 *   userRequest   — APIRequestContext с сессией обычного пользователя
 *   adminRequest  — APIRequestContext с сессией администратора
 *   anonRequest   — APIRequestContext без авторизации
 *   freshUser     — { email, password } + авторизованный request
 */
import { test as base, APIRequestContext, expect } from '@playwright/test';
import { API } from '../helpers/api';
import { makeUser, ADMIN, USER, type TestUser } from '../helpers/factories';

type Fixtures = {
  anonRequest:  APIRequestContext;
  userRequest:  APIRequestContext;
  adminRequest: APIRequestContext;
  freshUser:    { creds: TestUser; request: APIRequestContext };
};

export const test = base.extend<Fixtures>({

  /** Новый контекст без cookie/сессии */
  anonRequest: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:8000' });
    await use(ctx);
    await ctx.dispose();
  },

  /** Контекст с сессией USER (из globalSetup) */
  userRequest: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:8000' });
    const resp = await API.login(ctx, USER.email, USER.password);
    expect(resp.status(), 'user login failed').toBe(200);
    await use(ctx);
    await API.logout(ctx).catch(() => {});
    await ctx.dispose();
  },

  /** Контекст с сессией ADMIN (из globalSetup) */
  adminRequest: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:8000' });
    const resp = await API.login(ctx, ADMIN.email, ADMIN.password);
    expect(resp.status(), 'admin login failed').toBe(200);
    await use(ctx);
    await API.logout(ctx).catch(() => {});
    await ctx.dispose();
  },

  /**
   * Создаёт нового изолированного пользователя на каждый тест.
   * Гарантирует, что тест не зависит от состояния USER/ADMIN.
   */
  freshUser: async ({ playwright }, use) => {
    const ctx  = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:8000' });
    const creds = makeUser();

    const regResp = await API.register(ctx, creds);
    expect(regResp.status(), 'fresh user registration failed').toBe(200);

    await use({ creds, request: ctx });

    await API.logout(ctx).catch(() => {});
    await ctx.dispose();
  },
});

export { expect } from '@playwright/test';
