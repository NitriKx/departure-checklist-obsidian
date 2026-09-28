import { describe, expect, it } from 'vitest';
import {
	buildNumericScope,
	dateOffsetFromToday,
	evaluateExpression,
	formatNumber,
	isParseableExpression,
	renderTemplates,
} from '../src/expressions';
import { Question } from '../src/types';

describe('evaluateExpression', () => {
	it('evaluates arithmetic with spaces around operators', () => {
		const scope = { return: 6, departure: 1, days: 5 };
		expect(evaluateExpression('return - departure', scope)).toBe(5);
		expect(evaluateExpression('days - 1', scope)).toBe(4);
		expect(evaluateExpression('days / 2', scope)).toBe(2.5);
		expect(evaluateExpression('(days + 1) * 2', scope)).toBe(12);
		expect(evaluateExpression('-days', scope)).toBe(-5);
	});

	it('supports functions', () => {
		const scope = { days: 5 };
		expect(evaluateExpression('ceil(days / 2)', scope)).toBe(3);
		expect(evaluateExpression('floor(days / 2)', scope)).toBe(2);
		expect(evaluateExpression('min(days, 3)', scope)).toBe(3);
		expect(evaluateExpression('max(days, 3)', scope)).toBe(5);
		expect(evaluateExpression('abs(0 - days)', scope)).toBe(5);
	});

	it('returns null for invalid input or unbound identifiers', () => {
		expect(evaluateExpression('', {})).toBeNull();
		expect(evaluateExpression('days', {})).toBeNull();
		expect(evaluateExpression('days-1', { days: 5 })).toBeNull(); // parsed as identifier "days-1"
		expect(evaluateExpression('days +', { days: 5 })).toBeNull();
		expect(evaluateExpression('1 / 0', {})).toBeNull();
		expect(evaluateExpression('unknownFn(1)', {})).toBeNull();
	});

	it('checks syntax without requiring bound identifiers', () => {
		expect(isParseableExpression('return - departure')).toBe(true);
		expect(isParseableExpression('ceil(days / 2) +')).toBe(false);
	});
});

describe('dateOffsetFromToday', () => {
	it('counts days between a date and today', () => {
		const today = new Date(2026, 8, 27); // 2026-09-27 local time
		expect(dateOffsetFromToday('2026-09-27', today)).toBe(0);
		expect(dateOffsetFromToday('2026-10-02', today)).toBe(5);
		expect(dateOffsetFromToday('2026-09-20', today)).toBe(-7);
	});

	it('rejects malformed dates', () => {
		expect(dateOffsetFromToday('27-09-2026', new Date())).toBeNull();
		expect(dateOffsetFromToday('2026-13-01', new Date())).toBeNull();
	});
});

describe('buildNumericScope', () => {
	const questions: Question[] = [
		{ id: 'departure', label: 'When do you leave?', type: 'date' },
		{ id: 'return', label: 'When do you come back?', type: 'date' },
		{ id: 'people', label: 'How many people?', type: 'number' },
		{ id: 'tripType', label: 'Trip', type: 'select', options: [{ id: 'work', label: 'Work' }] },
	];
	const today = new Date(2026, 8, 27);

	it('derives date offsets, numbers, and computed values', () => {
		const scope = buildNumericScope(
			questions,
			{ departure: '2026-09-27', return: '2026-10-06', people: '3', tripType: 'work' },
			[{ name: 'days', expression: 'return - departure' }],
			today,
		);
		expect(scope.departure).toBe(0);
		expect(scope.return).toBe(9);
		expect(scope.people).toBe(3);
		expect(scope.days).toBe(9);
		expect(scope.tripType).toBeUndefined();
	});

	it('skips missing answers and failing computations', () => {
		const scope = buildNumericScope(
			questions,
			{ departure: '2026-09-27' },
			[
				{ name: 'days', expression: 'return - departure' },
				{ name: 'half', expression: 'ceil(days / 2)' },
			],
			today,
		);
		expect(scope.days).toBeUndefined();
		expect(scope.half).toBeUndefined();
	});
});

describe('renderTemplates', () => {
	it('replaces placeholders with formatted numbers', () => {
		expect(renderTemplates('Pack {ceil(days / 2)} t-shirts', { days: 5 })).toBe(
			'Pack 3 t-shirts',
		);
		expect(renderTemplates('Medication for {days} days', { days: 4 })).toBe(
			'Medication for 4 days',
		);
		expect(formatNumber(2.5)).toBe('2.5');
	});

	it('falls back to ? when the expression cannot be evaluated', () => {
		expect(renderTemplates('Pack {days} socks', {})).toBe('Pack ? socks');
		expect(renderTemplates('Pack {days +} socks', { days: 3 })).toBe('Pack ? socks');
	});
});
