import { describe, it, expect } from 'vitest';
import { beatsAtTime, timeAtBeats, nearestGridDeviation, median } from '../src/timing/tempoMath.js';

// 100 BPM for one bar (2.4s), then 120 BPM
const tempoMap = [
  { time: 0, bpm: 100 },
  { time: 2.4, bpm: 120 }
];

describe('beatsAtTime / timeAtBeats', () => {
  it('uses the fallback tempo when the map is empty', () => {
    expect(beatsAtTime([], 1.5, 120)).toBeCloseTo(3);
    expect(timeAtBeats([], 3, 120)).toBeCloseTo(1.5);
  });

  it('accumulates beats across a tempo change', () => {
    expect(beatsAtTime(tempoMap, 2.4, 100)).toBeCloseTo(4);
    expect(beatsAtTime(tempoMap, 2.9, 100)).toBeCloseTo(5); // 0.5s at 120 BPM = 1 beat
  });

  it('is the inverse of beatsAtTime', () => {
    for (const t of [0, 0.3, 2.39, 2.4, 3.1, 10]) {
      expect(timeAtBeats(tempoMap, beatsAtTime(tempoMap, t, 100), 100)).toBeCloseTo(t);
    }
  });
});

describe('nearestGridDeviation', () => {
  const sixteenths = 4; // grid lines per beat

  it('reports late hits as positive', () => {
    const { deviationMs, subdivision } = nearestGridDeviation([], 0.515, sixteenths, 120);
    expect(subdivision).toBe(4);
    expect(deviationMs).toBeCloseTo(15);
  });

  it('measures early hits against the upcoming grid line, not the previous one', () => {
    // 10ms before beat 2 at 120 BPM (grid line at 0.5s)
    const { deviationMs, subdivision } = nearestGridDeviation([], 0.49, sixteenths, 120);
    expect(subdivision).toBe(4);
    expect(deviationMs).toBeCloseTo(-10);
  });

  it('handles a tempo change between grid lines', () => {
    // Bar line at 2.4s; hit 5ms early
    const { deviationMs } = nearestGridDeviation(tempoMap, 2.395, sixteenths, 100);
    expect(deviationMs).toBeCloseTo(-5);
  });
});

describe('median', () => {
  it('handles odd, even and empty inputs', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
