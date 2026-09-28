import { DEFAULT_CONFIG } from './defaultConfig';
import { ChecklistConfig } from './types';

export function cloneConfig(config: ChecklistConfig): ChecklistConfig {
	return JSON.parse(JSON.stringify(config)) as ChecklistConfig;
}

/** The config to use: the customized one if present, otherwise the built-in defaults. */
export function getActiveConfig(custom: ChecklistConfig | null): ChecklistConfig {
	return custom ?? DEFAULT_CONFIG;
}
