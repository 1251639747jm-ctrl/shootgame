/**
 * 肉鸽模式入口
 *
 * 使用方法:
 *   import { RogueEngine } from './game/rogue';
 *   const rogue = new RogueEngine(canvas, () => { ... exit callback ... });
 *   rogue.start();
 */
export { RogueEngine } from './RogueEngine';
export {
    MagicCircle,
    MagicSpellFx,
    MagicMeteor,
    MagicNovaRing,
    MagicHomingOrb,
    MagicAuraField,
    MagicHammerStrike,
    MagicChainBolt,
    MagicThunderStrike,
    MagicRailBeam,
    FIRE_SKILLS,
    ELECTRIC_SKILLS,
    getSkillsForElement,
} from './MagicCircle';
export type { SpellContext } from './MagicCircle';
export { RogueUI } from './RogueUI';
export * from './RogueTypes';
