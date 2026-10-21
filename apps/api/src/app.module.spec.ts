import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { VALID_ENV } from './config/testing/expect-invalid';

describe('AppModule', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, VALID_ENV);
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('AC-07.6.1 compiles so the unit gate has a real test to run', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef.get(AppModule)).toBeInstanceOf(AppModule);
  });
});
