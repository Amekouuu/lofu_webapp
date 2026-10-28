import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast and removes it by itself', () => {
    service.success('Saved');
    expect(service.toasts().map((t) => t.message)).toEqual(['Saved']);

    vi.advanceTimersByTime(4001);
    expect(service.toasts()).toEqual([]);
  });

  it('keeps errors on screen longer than other toasts', () => {
    service.error('Something broke');

    vi.advanceTimersByTime(4001);
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(3000);
    expect(service.toasts().length).toBe(0);
  });

  it('does not stack identical messages', () => {
    service.error("Can't reach the server");
    service.error("Can't reach the server");
    service.error("Can't reach the server");

    expect(service.toasts().length).toBe(1);
  });

  it('shows at most 4 toasts, dropping the oldest', () => {
    for (const n of [1, 2, 3, 4, 5]) service.info('message ' + n);

    expect(service.toasts().map((t) => t.message)).toEqual(['message 2', 'message 3', 'message 4', 'message 5']);
  });

  it('can dismiss a single toast', () => {
    service.info('first');
    service.info('second');

    service.dismiss(service.toasts()[0].id);
    expect(service.toasts().map((t) => t.message)).toEqual(['second']);
  });
});
