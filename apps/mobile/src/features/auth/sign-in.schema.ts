import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().trim().pipe(z.email('Informe um e-mail válido')),
  password: z.string().min(1, 'Este campo é obrigatório'),
});

export type SignInValues = z.infer<typeof signInSchema>;
