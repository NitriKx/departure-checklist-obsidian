export interface QuestionOption {
	id: string;
	label: string;
}

/**
 * A condition is true when the answer to `question` matches the given
 * criteria. String criteria (equals / notEquals / in) compare the raw
 * answer; numeric criteria (greaterThan / lessThan) evaluate `question`
 * as a number (date answers count in days from today, number answers
 * are used as-is) and compare it to the given bound.
 */
export interface Condition {
	question: string;
	equals?: string;
	notEquals?: string;
	in?: string[];
	greaterThan?: string;
	lessThan?: string;
}

export type QuestionType = 'select' | 'toggle' | 'date' | 'number';

export interface Question {
	id: string;
	label: string;
	type: QuestionType;
	options?: QuestionOption[];
	default?: string;
	min?: number;
	showWhen?: Condition;
}

export interface ChecklistItem {
	text: string;
	when?: Condition;
}

export interface ChecklistSection {
	id: string;
	title: string;
	includeWhen?: Condition;
	items: (string | ChecklistItem)[];
}

export interface ChecklistConfig {
	questions: Question[];
	sections: ChecklistSection[];
	/** Named values computed from date/number answers, e.g. trip length. */
	computed?: ComputedVariable[];
}

export interface ComputedVariable {
	name: string;
	expression: string;
}

export type Answers = Record<string, string>;

export const TOGGLE_YES = 'yes';
export const TOGGLE_NO = 'no';
export const TOGGLE_ANSWERS = [TOGGLE_YES, TOGGLE_NO];
