import { z } from 'zod';
import { locales } from './i18n';
const id = z.string().min(1).max(100);
const optionalId = id.nullish().transform((v) => v || null);
const name = z.string().trim().min(1).max(100);
export const money = z.coerce
  .number()
  .min(0.01)
  .max(999999999)
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 0.0001);
const signed = z.coerce
  .number()
  .min(-999999999)
  .max(999999999)
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 0.0001);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const optDate = date.nullish().transform((v) => v || null);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const kind = z.enum(['income', 'expense']);
export const authSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
  name: name.optional(),
  mode: z.enum(['login', 'register']),
  locale: z.string().refine((v) => Object.hasOwn(locales, v)).optional(),
});
export const schemas = {
  accounts: z.object({
    name,
    kind: z.enum(['bank', 'cash', 'savings', 'investment', 'credit']),
    openingBalance: signed,
    color,
  }),
  categories: z.object({ name, kind, parentId: optionalId, color }),
  transactions: z.object({
    accountId: id,
    toAccountId: optionalId,
    categoryId: optionalId,
    kind: z.enum(['income', 'expense', 'transfer']),
    amount: money,
    description: name,
    date,
    note: z.string().max(2000).default(''),
  }),
  budgets: z.object({
    categoryId: id,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    amount: money,
  }),
  goals: z
    .object({
      name,
      target: money,
      saved: signed.refine((v) => v >= 0),
      deadline: optDate,
      color,
    })
    .refine((v) => v.saved <= v.target),
  debts: z
    .object({
      name,
      direction: z.enum(['owe', 'owed']),
      principal: money,
      remaining: signed.refine((v) => v >= 0),
      interestRate: z.coerce.number().min(0).max(1000),
      dueDate: optDate,
    })
    .refine((v) => v.remaining <= v.principal),
  recurring: z.object({
    accountId: id,
    categoryId: optionalId,
    kind,
    amount: money,
    description: name,
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    nextDate: date,
    active: z.boolean().default(true),
  }),
};
export const settingsSchema = z.object({
  name,
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  locale: z.string().refine((v) => v in locales),
  currency: z.enum([
    'USD',
    'EUR',
    'KZT',
    'RUB',
    'GBP',
    'TRY',
    'JPY',
    'CNY',
    'INR',
    'KRW',
    'UAH',
    'BRL',
    'AED',
  ]),
  theme: z.enum(['light', 'dark', 'system']),
  style: z.enum(['clean', 'glass', 'minimal', 'contrast', 'soft']),
  accent: color,
});
