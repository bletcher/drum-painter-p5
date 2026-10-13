/**
 * Tempo Math
 * Pure functions for converting between time and beats on a tempo map.
 *
 * A tempo map is an array of { time, bpm } entries sorted by time, where `time`
 * is seconds since the start of the (post-warm-up) timeline and the first entry
 * is at time 0. Each entry's bpm applies until the next entry.
 */

/**
 * Beats elapsed at a given time
 * @param {Array<{time: number, bpm: number}>} tempoMap
 * @param {number} time - Seconds since timeline start
 * @param {number} fallbackBpm - Used when the map is empty
 * @returns {number} - Beats (quarter notes) since timeline start
 */
export function beatsAtTime(tempoMap, time, fallbackBpm) {
  if (!tempoMap || tempoMap.length === 0) {
    return time / (60 / fallbackBpm);
  }

  let totalBeats = 0;
  let previousTime = 0;
  let previousBpm = tempoMap[0].bpm;

  for (let i = 1; i < tempoMap.length; i++) {
    const entry = tempoMap[i];
    if (entry.time > time) break;
    totalBeats += (entry.time - previousTime) / (60 / previousBpm);
    previousTime = entry.time;
    previousBpm = entry.bpm;
  }

  return totalBeats + (time - previousTime) / (60 / previousBpm);
}

/**
 * Time at which a given beat count is reached (inverse of beatsAtTime)
 * @param {Array<{time: number, bpm: number}>} tempoMap
 * @param {number} beats - Beats (quarter notes) since timeline start
 * @param {number} fallbackBpm - Used when the map is empty
 * @returns {number} - Seconds since timeline start
 */
export function timeAtBeats(tempoMap, beats, fallbackBpm) {
  if (!tempoMap || tempoMap.length === 0) {
    return beats * (60 / fallbackBpm);
  }

  let accumulatedBeats = 0;
  let accumulatedTime = 0;
  let previousBpm = tempoMap[0].bpm;

  for (let i = 1; i < tempoMap.length; i++) {
    const entry = tempoMap[i];
    const secondsPerBeat = 60 / previousBpm;
    const beatsInPeriod = (entry.time - accumulatedTime) / secondsPerBeat;

    if (accumulatedBeats + beatsInPeriod >= beats) {
      return accumulatedTime + (beats - accumulatedBeats) * secondsPerBeat;
    }

    accumulatedBeats += beatsInPeriod;
    accumulatedTime = entry.time;
    previousBpm = entry.bpm;
  }

  return accumulatedTime + (beats - accumulatedBeats) * (60 / previousBpm);
}

/**
 * Find the grid line nearest to a hit and how far off the hit was.
 * Looks both backwards and forwards, so early hits are measured against the
 * upcoming grid line rather than the previous one.
 * @param {Array<{time: number, bpm: number}>} tempoMap
 * @param {number} hitTime - Seconds since timeline start
 * @param {number} subdivisionsPerBeat - Grid lines per quarter note (e.g. 3 for triplets)
 * @param {number} fallbackBpm - Used when the map is empty
 * @returns {{subdivision: number, gridTime: number, deviationMs: number}}
 *   deviationMs is positive when late, negative when early
 */
export function nearestGridDeviation(tempoMap, hitTime, subdivisionsPerBeat, fallbackBpm) {
  const subdivisionFloat = beatsAtTime(tempoMap, hitTime, fallbackBpm) * subdivisionsPerBeat;
  const lower = Math.floor(subdivisionFloat);
  const lowerTime = timeAtBeats(tempoMap, lower / subdivisionsPerBeat, fallbackBpm);
  const upperTime = timeAtBeats(tempoMap, (lower + 1) / subdivisionsPerBeat, fallbackBpm);

  // Compare in time (not beats) so a tempo change between the two lines is handled
  const useUpper = (upperTime - hitTime) < (hitTime - lowerTime);
  const subdivision = useUpper ? lower + 1 : lower;
  const gridTime = useUpper ? upperTime : lowerTime;

  return {
    subdivision,
    gridTime,
    deviationMs: (hitTime - gridTime) * 1000
  };
}

/**
 * Median of an array of numbers (used for latency calibration)
 * @param {number[]} values
 * @returns {number|null}
 */
export function median(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
