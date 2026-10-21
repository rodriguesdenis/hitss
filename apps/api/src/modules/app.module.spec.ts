import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  it('AC-07.6.1 compiles so the unit gate has a real test to run', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef.get(AppModule)).toBeInstanceOf(AppModule);
  });
});
