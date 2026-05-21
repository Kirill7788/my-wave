/**
 * helpers/factories.ts
 * Детерминированные фабрики тестовых данных.
 * Каждая фабрика генерирует уникальные значения через seed/counter,
 * чтобы тесты не конфликтовали при параллельном запуске.
 */
import { randomBytes } from 'crypto';

let counter = 0;

function uid(): string {
  counter++;
  return `${Date.now()}-${counter}-${randomBytes(3).toString('hex')}`;
}

// ── User factory ─────────────────────────────────────────────────────────────

export interface TestUser {
  email:      string;
  password:   string;
  first_name: string;
  phone:      string;
}

export function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    email:      `u-${uid()}@mywave.test`,
    password:   'TestPass123!',
    first_name: 'Test',
    phone:      '+375291234567',
    ...overrides,
  };
}

// ── Booking factory ───────────────────────────────────────────────────────────

export interface TestBooking {
  cottage_id:  number;
  check_in:    string;
  check_out:   string;
  adults:      number;
  children:    number;
  guest_name:  string;
  guest_phone: string;
  guest_email: string;
}

/** Даты в 2027 году — заведомо в будущем и не пересекаются с seed-данными. */
export function makeBooking(overrides: Partial<TestBooking> = {}): TestBooking {
  return {
    cottage_id:  1,           // naroch-econ-1 из seed.sql
    check_in:    '2027-09-01',
    check_out:   '2027-09-05',
    adults:      2,
    children:    0,
    guest_name:  'Test Guest',
    guest_phone: '+375291234567',
    guest_email: `g-${uid()}@mywave.test`,
    ...overrides,
  };
}

/** Генерирует непересекающиеся диапазоны дат. */
export function futureDate(offsetDays: number): string {
  const d = new Date('2027-10-01');
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// ── Card factory ──────────────────────────────────────────────────────────────

export interface TestCard {
  card_number: string;
  card_holder: string;
  exp_month:   number;
  exp_year:    number;
  cvc:         string;
}

export function makeCard(overrides: Partial<TestCard> = {}): TestCard {
  return {
    card_number: '4111 1111 1111 1111',
    card_holder: 'TEST USER',
    exp_month:   12,
    exp_year:    2028,
    cvc:         '123',
    ...overrides,
  };
}

// ── Fixed test credentials (created in globalSetup) ───────────────────────────

export const ADMIN = { email: 'admin@mywave.test', password: 'AdminPass123!' };
export const USER  = { email: 'user@mywave.test',  password: 'UserPass123!' };

// ── XSS payloads ─────────────────────────────────────────────────────────────

export const XSS_PAYLOADS = [
  '<script>window.__xss=true</script>',
  '<img src=x onerror="window.__xss=true">',
  '"><svg onload="window.__xss=true">',
  "'; DROP TABLE users; --",
  '<iframe src="javascript:window.__xss=true">',
  '{{7*7}}',              // template injection
  '<script>',   // unicode escape
];

export const SQL_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "1; SELECT * FROM users",
  "' UNION SELECT email, password_hash FROM users --",
];
