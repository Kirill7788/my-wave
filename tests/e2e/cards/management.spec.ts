/**
 * cards/management.spec.ts
 * Payment cards CRUD: добавление, default, удаление, валидация.
 */
import { test, expect } from '../../fixtures';
import { API } from '../../helpers/api';
import { makeCard } from '../../helpers/factories';

test.describe('Payment cards management', () => {

  test('add valid card returns 200', async ({ freshUser }) => {
    const resp = await API.addCard(freshUser.request, makeCard());
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
  });

  test('added card appears in GET /cards.php', async ({ freshUser }) => {
    await API.addCard(freshUser.request, makeCard());

    const resp = await API.getCards(freshUser.request);
    const body = await resp.json();
    expect(Array.isArray(body.cards)).toBe(true);
    expect(body.cards.length).toBeGreaterThan(0);

    const card = body.cards[0];
    // Только last_4 — не полный номер
    expect(card).toHaveProperty('card_last_4');
    expect(card.card_last_4).toBe('1111'); // Visa test card
    expect(card).not.toHaveProperty('card_number_hash');
    expect(card).not.toHaveProperty('cvc');
    // Полный номер карты не должен быть в ответе
    expect(JSON.stringify(card)).not.toMatch(/4111111111111111/);
  });

  test('set default card changes is_default flag', async ({ freshUser }) => {
    await API.addCard(freshUser.request, makeCard());
    await API.addCard(freshUser.request, makeCard({ card_number: '5500 0000 0000 0004' }));

    const cards = await (await API.getCards(freshUser.request)).json();
    const id = cards.cards[1].id; // вторая карта

    await API.setDefaultCard(freshUser.request, id);

    const after = await (await API.getCards(freshUser.request)).json();
    const defaultCard = after.cards.find((c: { is_default: boolean }) => c.is_default);
    expect(defaultCard?.id).toBe(id);
    // Только одна карта default
    const defaultCount = after.cards.filter((c: { is_default: boolean }) => c.is_default).length;
    expect(defaultCount).toBe(1);
  });

  test('delete card removes it from list', async ({ freshUser }) => {
    await API.addCard(freshUser.request, makeCard());
    const before = await (await API.getCards(freshUser.request)).json();
    const cardId = before.cards[0].id;

    await API.deleteCard(freshUser.request, cardId);

    const after = await (await API.getCards(freshUser.request)).json();
    const found = after.cards.find((c: { id: number }) => c.id === cardId);
    expect(found).toBeUndefined();
  });

  test.describe('card validation', () => {
    const invalidCards = [
      ['invalid card number length', makeCard({ card_number: '1234 5678' })],
      ['non-numeric card number', makeCard({ card_number: 'xxxx xxxx xxxx xxxx' })],
      ['expired card', makeCard({ exp_month: 1, exp_year: 2020 })],
      ['invalid month 13', makeCard({ exp_month: 13 })],
      ['missing card_holder', makeCard({ card_holder: '' })],
    ] as const;

    for (const [name, card] of invalidCards) {
      test(`${name} returns 422`, async ({ freshUser }) => {
        const resp = await API.addCard(freshUser.request, card as ReturnType<typeof makeCard>);
        expect(resp.status()).toBe(422);
      });
    }
  });

  test('unauthenticated GET /cards.php returns 401', async ({ anonRequest }) => {
    const resp = await API.getCards(anonRequest);
    expect(resp.status()).toBe(401);
  });
});
