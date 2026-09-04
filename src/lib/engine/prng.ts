/**
 * Deterministic Pseudo-Random Number Generator (Mulberry32 + MurmurHash3)
 * Guarantees 100% reproducible benchmark state across any runtime.
 */
export class PRNG {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed : PRNG.hashString(seed);
  }

  public static hashString(str: string): number {
    let hash = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return hash >>> 0;
  }

  // Returns float in [0, 1)
  public nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns integer in [min, max] inclusive
  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  // Returns boolean with given probability
  public nextBool(probability = 0.5): boolean {
    return this.nextFloat() < probability;
  }

  // Pick random element from array
  public pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  // Deterministic hex ID
  public nextId(prefix = 'id'): string {
    const hex = Math.floor(this.nextFloat() * 0xffffffff).toString(16).padStart(8, '0');
    return `${prefix}-${hex}`;
  }
}
