import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  let service: ConfirmService;

  beforeEach(() => {
    service = TestBed.inject(ConfirmService);
  });

  it('resolves true when confirmed and closes the dialog', async () => {
    const answer = service.confirm({ title: 'Sure?', message: 'Really?' });
    expect(service.request()?.title).toBe('Sure?');

    service.answer(true);

    expect(await answer).toBe(true);
    expect(service.request()).toBeNull();
  });

  it('resolves false when cancelled', async () => {
    const answer = service.confirm({ title: 'Sure?', message: 'Really?' });
    service.answer(false);

    expect(await answer).toBe(false);
  });

  it('cancels an older dialog when a newer one opens', async () => {
    const first = service.confirm({ title: 'First', message: '' });
    const second = service.confirm({ title: 'Second', message: '' });

    expect(await first).toBe(false);
    expect(service.request()?.title).toBe('Second');

    service.answer(true);
    expect(await second).toBe(true);
  });

  it('ignores an answer when nothing is open', () => {
    expect(() => service.answer(true)).not.toThrow();
  });
});
