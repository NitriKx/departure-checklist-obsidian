import {
	Answers,
	ComputedVariable,
	Question,
} from './types';

/**
 * Tiny safe arithmetic evaluator for item templates and numeric
 * conditions. Supports + - * /, parentheses, the functions ceil, floor,
 * round, abs, min, max, and identifiers bound to question answers or
 * computed variables.
 *
 * Identifiers may contain hyphens (question ids are slugs), so put spaces
 * around + and - to have them treated as operators: "days - 1".
 */

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
	ceil: Math.ceil,
	floor: Math.floor,
	round: Math.round,
	abs: Math.abs,
	min: Math.min,
	max: Math.max,
};

type Token = { kind: 'number'; value: number } | { kind: 'ident'; value: string } | { kind: 'op'; value: string };

function tokenize(expression: string): Token[] | null {
	const tokens: Token[] = [];
	let rest = expression.trim();
	while (rest.length > 0) {
		rest = rest.replace(/^\s+/, '');
		if (rest.length === 0) {
			break;
		}
		const numberMatch = /^(\d+(?:\.\d+)?)([\s\S]*)$/.exec(rest);
		if (numberMatch) {
			tokens.push({ kind: 'number', value: Number(numberMatch[1] ?? '') });
			rest = numberMatch[2] ?? '';
			continue;
		}
		const identMatch = /^([A-Za-z_][A-Za-z0-9_-]*)([\s\S]*)$/.exec(rest);
		if (identMatch) {
			tokens.push({ kind: 'ident', value: identMatch[1] ?? '' });
			rest = identMatch[2] ?? '';
			continue;
		}
		const opMatch = /^([+\-*/(),])([\s\S]*)$/.exec(rest);
		if (opMatch) {
			tokens.push({ kind: 'op', value: opMatch[1] ?? '' });
			rest = opMatch[2] ?? '';
			continue;
		}
		return null;
	}
	return tokens;
}

class Parser {
	private position = 0;

	constructor(private tokens: Token[], private scope: Record<string, number>) {}

	parse(): number | null {
		const value = this.expr();
		if (value === null || this.position !== this.tokens.length) {
			return null;
		}
		return Number.isFinite(value) ? value : null;
	}

	private peek(): Token | undefined {
		return this.tokens[this.position];
	}

	private eatOp(value: string): boolean {
		const token = this.peek();
		if (token && token.kind === 'op' && token.value === value) {
			this.position += 1;
			return true;
		}
		return false;
	}

	private expr(): number | null {
		let left = this.term();
		if (left === null) {
			return null;
		}
		for (;;) {
			if (this.eatOp('+')) {
				const right = this.term();
				if (right === null) return null;
				left += right;
			} else if (this.eatOp('-')) {
				const right = this.term();
				if (right === null) return null;
				left -= right;
			} else {
				return left;
			}
		}
	}

	private term(): number | null {
		let left = this.factor();
		if (left === null) {
			return null;
		}
		for (;;) {
			if (this.eatOp('*')) {
				const right = this.factor();
				if (right === null) return null;
				left *= right;
			} else if (this.eatOp('/')) {
				const right = this.factor();
				if (right === null) return null;
				left /= right;
			} else {
				return left;
			}
		}
	}

	private factor(): number | null {
		if (this.eatOp('-')) {
			const value = this.factor();
			return value === null ? null : -value;
		}
		if (this.eatOp('(')) {
			const value = this.expr();
			if (value === null || !this.eatOp(')')) {
				return null;
			}
			return value;
		}
		const token = this.peek();
		if (!token) {
			return null;
		}
		if (token.kind === 'number') {
			this.position += 1;
			return token.value;
		}
		if (token.kind === 'ident') {
			this.position += 1;
			if (this.eatOp('(')) {
				const args: number[] = [];
				if (!this.eatOp(')')) {
					for (;;) {
						const arg = this.expr();
						if (arg === null) return null;
						args.push(arg);
						if (this.eatOp(',')) {
							continue;
						}
						if (this.eatOp(')')) {
							break;
						}
						return null;
					}
				}
				const fn = FUNCTIONS[token.value];
				if (!fn) {
					return null;
				}
				return fn(...args);
			}
			const bound = this.scope[token.value];
			return bound === undefined ? null : bound;
		}
		return null;
	}
}

/** Evaluate an expression against a numeric scope. Returns null on any error. */
export function evaluateExpression(expression: string, scope: Record<string, number>): number | null {
	const tokens = tokenize(expression);
	if (!tokens || tokens.length === 0) {
		return null;
	}
	return new Parser(tokens, scope).parse();
}

/** True when the expression is syntactically valid (identifiers need not resolve). */
export function isParseableExpression(expression: string): boolean {
	const permissiveScope = new Proxy(
		{},
		{ get: () => 1 },
	) as unknown as Record<string, number>;
	return evaluateExpression(expression, permissiveScope) !== null;
}

/** Days between a YYYY-MM-DD date and `today` (positive = in the future). */
export function dateOffsetFromToday(answer: string, today: Date): number | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(answer);
	if (!match) {
		return null;
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (month < 1 || month > 12 || day < 1 || day > 31) {
		return null;
	}
	const target = Date.UTC(year, month - 1, day);
	const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
	return Math.round((target - base) / 86_400_000);
}

/**
 * Numeric values available to conditions and item templates:
 * date answers as days from today, number answers as numbers, and
 * computed variables evaluated in order.
 */
export function buildNumericScope(
	questions: Question[],
	answers: Answers,
	computed: ComputedVariable[] | undefined,
	today: Date,
): Record<string, number> {
	const scope: Record<string, number> = {};
	for (const question of questions) {
		const answer = answers[question.id];
		if (answer === undefined || answer === '') {
			continue;
		}
		if (question.type === 'number') {
			const value = Number(answer);
			if (Number.isFinite(value)) {
				scope[question.id] = value;
			}
		} else if (question.type === 'date') {
			const offset = dateOffsetFromToday(answer, today);
			if (offset !== null) {
				scope[question.id] = offset;
			}
		}
	}
	for (const variable of computed ?? []) {
		const value = evaluateExpression(variable.expression, scope);
		if (value !== null) {
			scope[variable.name] = value;
		}
	}
	return scope;
}

export function formatNumber(value: number): string {
	if (Math.abs(value - Math.round(value)) < 1e-9) {
		return String(Math.round(value));
	}
	return String(Math.round(value * 10) / 10);
}

/** Replace {expression} placeholders in an item text with computed numbers. */
export function renderTemplates(text: string, scope: Record<string, number>): string {
	return text.replace(/\{([^{}]+)\}/g, (_match, expression: string) => {
		const value = evaluateExpression(expression, scope);
		return value === null ? '?' : formatNumber(value);
	});
}
