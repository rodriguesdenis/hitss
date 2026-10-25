import {
  teamsCreateBodyDescriptionMax,
  teamsCreateBodyNameMax,
  teamsCreateBodyNameMin,
} from '@hitss/api-client/zod';
import { z } from 'zod';

export const NAME_MESSAGE = 'O nome deve ter de 2 a 50 caracteres';
export const COLOR_MESSAGE = 'Use uma cor como #6366F1';
export const DESCRIPTION_MESSAGE = `A descrição deve ter no máximo ${teamsCreateBodyDescriptionMax} caracteres`;
export const DUPLICATE_NAME_MESSAGE = 'Você já tem um time com este nome.';

export const DESCRIPTION_MAX = teamsCreateBodyDescriptionMax;
export const NAME_MAX = teamsCreateBodyNameMax;

const HEX = /^#?[0-9a-f]{6}$/i;

export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX.test(trimmed)) {
    return null;
  }
  return `#${trimmed.replace('#', '').toUpperCase()}`;
}

export const teamFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(teamsCreateBodyNameMin, NAME_MESSAGE)
    .max(teamsCreateBodyNameMax, NAME_MESSAGE),
  colorHex: z
    .string()
    .refine((value) => normalizeHex(value) !== null, COLOR_MESSAGE)
    .transform((value) => normalizeHex(value)!),
  description: z
    .string()
    .max(teamsCreateBodyDescriptionMax, DESCRIPTION_MESSAGE)
    .transform((value) => value.trim() || null),
});

export type TeamFormValues = z.input<typeof teamFormSchema>;

export type TeamFormOutput = z.output<typeof teamFormSchema>;
