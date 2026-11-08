/**
 * The diner feature mount points (U5 Step 13, BR14.2, contract 7): one per U6 feature area, all listed
 * here, so U6 only replaces the file inside its own folder and never edits this one.
 */
export { default as OptionsFeature } from './options/index.js';
export { default as AllergiesFeature } from './allergies/index.js';
export { default as EstimateFeature } from './estimate/index.js';
export { default as TrackerFeature } from './tracker/index.js';
export { default as ReadyBannerFeature } from './ready-banner/index.js';
export { default as SameAgainFeature } from './same-again/index.js';
export { default as HelpCardFeature } from './help-card/index.js';
export { default as SpecialCardFeature } from './special-card/index.js';
export { default as RatingFeature } from './rating/index.js';
export { default as SettingsFeature } from './settings/index.js';

/** The folder names, for tests. */
export const DINER_FEATURE_FOLDERS = [
  'options',
  'allergies',
  'estimate',
  'tracker',
  'ready-banner',
  'same-again',
  'help-card',
  'special-card',
  'rating',
  'settings',
] as const;
