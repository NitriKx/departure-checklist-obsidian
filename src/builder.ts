import { evalCondition, isQuestionVisible } from './conditions';
import { buildNumericScope, renderTemplates } from './expressions';
import {
	Answers,
	ChecklistConfig,
	ChecklistItem,
	ChecklistSection,
	Question,
} from './types';

export interface IncludedSection {
	section: ChecklistSection;
	items: ChecklistItem[];
}

export function scopeFor(config: ChecklistConfig, answers: Answers, today: Date): Record<string, number> {
	return buildNumericScope(config.questions, answers, config.computed, today);
}

/** Sections that apply to the given answers, with their filtered items. */
export function includedSections(
	config: ChecklistConfig,
	answers: Answers,
	today: Date = new Date(),
): IncludedSection[] {
	const scope = scopeFor(config, answers, today);
	const result: IncludedSection[] = [];
	for (const section of config.sections) {
		if (section.includeWhen && !evalCondition(section.includeWhen, answers, scope)) {
			continue;
		}
		const items = section.items
			.map((item): ChecklistItem => (typeof item === 'string' ? { text: item } : item))
			.filter((item) => !item.when || evalCondition(item.when, answers, scope));
		if (items.length === 0) {
			continue;
		}
		result.push({ section, items });
	}
	return result;
}

export function visibleQuestions(
	questions: Question[],
	answers: Answers,
	scope: Record<string, number>,
): Question[] {
	return questions.filter((question) => isQuestionVisible(question, answers, scope));
}

export function buildChecklistMarkdown(
	config: ChecklistConfig,
	answers: Answers,
	date: string,
): string {
	const scope = scopeFor(config, answers, new Date());
	const lines: string[] = [`# Departure checklist - ${date}`, ''];
	for (const { section, items } of includedSections(config, answers, new Date())) {
		lines.push(`## ${section.title}`);
		for (const item of items) {
			lines.push(`- [ ] ${renderTemplates(item.text, scope)}`);
		}
		lines.push('');
	}
	return lines.join('\n');
}
