import { describe, expect, it } from 'vitest';
import { memoryProfile } from './memoryProfile';

describe('memoryProfile', () => {
  it('nutzt 1 Worker, wenn der Browser keinen Speicherwert meldet (Safari, Firefox)', () => {
    expect(memoryProfile({ hardwareConcurrency: 8 })).toEqual({ stretchWorkers: 1, marginBars: 16, light: false });
  });
  it('erlaubt 2 Worker auf großzügigen Geräten', () => {
    expect(memoryProfile({ deviceMemoryGb: 16, hardwareConcurrency: 8 }).stretchWorkers).toBe(2);
  });
  it('schaltet bei 4 GB oder weniger in den leichten Modus', () => {
    expect(memoryProfile({ deviceMemoryGb: 4, hardwareConcurrency: 4 })).toEqual({ stretchWorkers: 1, marginBars: 8, light: true });
  });
  it('nie mehr als 2 Worker', () => {
    expect(memoryProfile({ deviceMemoryGb: 64, hardwareConcurrency: 32 }).stretchWorkers).toBeLessThanOrEqual(2);
  });
});
