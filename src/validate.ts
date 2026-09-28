import { isParseableExpression } from './expressions';
import {
	ChecklistConfig,
	Condition,
	Question,
	TOGGLE_ANSWERS,
} from './types';

function validAnswersFor(question: Question): string[] {
	if (question.type === 'toggle') {
		return TOGGLE_ANSWERS;
	}
	if (question.type === 'select') {
		return (question.options ?? []).map((option) => option.id);
	}
	return [];
}

function isNumericSource(question: Question | undefined, computedNames: Set<string>, id: string): boolean {
	if (question && (question.type === 'number' || question.type === 'date')) {
		return true;
	}
	return computedNames.has(id);
}

/** Check every condition and template against what it references. Returns user-readable errors. */
export function validateConditions(config: ChecklistConfig): string[] {
	const errors: string[] = [];
	const questionsById = new Map(config.questions.map((q) => [q.id, q]));
	const computedNames = new Set((config.computed ?? []).map((c) => c.name));

	const check = (condition: Condition | undefined, where: string): void => {
		if (!condition) {
			return;
		}
		if (!condition.question) {
			errors.push(`${where}: condition is missing a question.`);
			return;
		}
		const question = questionsById.get(condition.question);
		const known = question !== undefined || computedNames.has(condition.question);
		if (!known) {
			errors.push(
				`${where}: condition references unknown question or value "${condition.question}".`,
			);
			return;
		}
		const valid = question ? validAnswersFor(question) : [];
		if (condition.equals !== undefined && !valid.includes(condition.equals)) {
			errors.push(
				`${where}: "${condition.equals}" is not a valid answer for question "${condition.question}".`,
			);
		}
		if (condition.notEquals !== undefined && !valid.includes(condition.notEquals)) {
			errors.push(
				`${where}: "${condition.notEquals}" is not a valid answer for question "${condition.question}".`,
			);
		}
		for (const candidate of condition.in ?? []) {
			if (!valid.includes(candidate)) {
				errors.push(
					`${where}: "${candidate}" is not a valid answer for question "${condition.question}".`,
				);
			}
		}
		for (const [field, bound] of [
			['greaterThan', condition.greaterThan],
			['lessThan', condition.lessThan],
		] as const) {
			if (bound === undefined) {
				continue;
			}
			if (!isNumericSource(question, computedNames, condition.question)) {
				errors.push(
					`${where}: "${condition.question}" cannot be compared with ${field} (only number questions or computed values).`,
				);
			}
			if (!Number.isFinite(Number(bound))) {
				errors.push(`${where}: ${field} must be a number.`);
			}
		}
	};

	const checkTemplates = (text: string, where: string): void => {
		for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
			const expression = match[1] ?? '';
			if (!isParseableExpression(expression)) {
				errors.push(`${where}: invalid expression "{${expression}}".`);
			}
		}
	};

	for (const question of config.questions) {
		check(question.showWhen, `Question "${question.id}"`);
	}
	for (const section of config.sections) {
		check(section.includeWhen, `Section "${section.id}"`);
		section.items.forEach((item, index) => {
			const asObject = typeof item === 'string' ? { text: item } : item;
			if (!asObject.text) {
				errors.push(`Section "${section.id}" item ${index + 1}: missing text.`);
			} else {
				checkTemplates(asObject.text, `Section "${section.id}" item ${index + 1}`);
			}
			if (typeof item !== 'string') {
				check(item.when, `Section "${section.id}" item ${index + 1}`);
			}
		});
	}
	for (const variable of config.computed ?? []) {
		if (!isParseableExpression(variable.expression)) {
			errors.push(`Computed value "${variable.name}": invalid expression "${variable.expression}".`);
		}
	}
	return errors;
}
