import { ArchetypeId } from '../types';
import { IncidentArchetype } from './base';
import { PoisonPillArchetype } from './poison-pill';
import { LostUpdateArchetype } from './lost-update';
import { TimeoutStarvationArchetype } from './timeout-starvation';
import { TokenDesyncArchetype } from './token-desync';

const ARCHETYPES: Record<ArchetypeId, IncidentArchetype> = {
  POISON_PILL_PANIC: new PoisonPillArchetype(),
  LOST_UPDATE_CONCURRENCY: new LostUpdateArchetype(),
  TIMEOUT_POOL_STARVATION: new TimeoutStarvationArchetype(),
  AUTH_TOKEN_ROTATION_DESYNC: new TokenDesyncArchetype(),
};

export function getArchetype(id: ArchetypeId): IncidentArchetype {
  const arch = ARCHETYPES[id];
  if (!arch) {
    throw new Error(`Unknown incident archetype ID: ${id}`);
  }
  return arch;
}

export function listArchetypes(): IncidentArchetype[] {
  return Object.values(ARCHETYPES);
}

export function pickArchetypeBySeed(seed: string): IncidentArchetype {
  const keys = Object.keys(ARCHETYPES) as ArchetypeId[];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % keys.length;
  return ARCHETYPES[keys[index]];
}
