import { describe, expect, it } from 'vitest';
import { evalCondition, isQuestionVisible } from '../src/conditions';
import { Answers, Question } from '../src/types';

describe('evalCondition', () => {
	it('matches equals', () => {
		const answers: Answers = { transport: 'plane' };
		expect(evalCondition({ question: 'transport', equals: 'plane' }, answers, {})).toBe(true);
		expect(evalCondition({ question: 'transport', equals: 'car' }, answers, {})).toBe(false);
	});

	it('does not match equals when unanswered', () => {
		expect(evalCondition({ question: 'transport', equals: 'plane' }, {}, {})).toBe(false);
	});

	it('matches notEquals and in', () => {
		const answers: Answers = { transport: 'car', duration: 'week' };
		expect(
			evalCondition({ question: 'transport', notEquals: 'plane' }, answers, {}),
		).toBe(true);
		expect(
			evalCondition({ question: 'duration', in: ['week', 'long'] }, answers, {}),
		).toBe(true);
		expect(evalCondition({ question: 'duration', in: ['short'] }, answers, {})).toBe(false);
	});

	it('compares numbers with greaterThan and lessThan', () => {
		const scope = { days: 9 };
		expect(evalCondition({ question: 'days', greaterThan: '7' }, {}, scope)).toBe(true);
		expect(evalCondition({ question: 'days', greaterThan: '10' }, {}, scope)).toBe(false);
		expect(evalCondition({ question: 'days', lessThan: '10' }, {}, scope)).toBe(true);
		expect(evalCondition({ question: 'days', lessThan: '9' }, {}, scope)).toBe(false);
	});

	it('returns false for numeric conditions without a value', () => {
		expect(evalCondition({ question: 'days', greaterThan: '7' }, {}, {})).toBe(false);
	});

	it('is true when no criterion is given', () => {
		expect(evalCondition({ question: 'duration' }, { duration: 'week' }, {})).toBe(true);
	});
});

describe('isQuestionVisible', () => {
	const question: Question = {
		id: 'pets',
		label: 'Pets?',
		type: 'toggle',
		showWhen: { question: 'days', greaterThan: '2' },
	};

	it('is visible when the numeric condition is met', () => {
		expect(isQuestionVisible(question, {}, { days: 5 })).toBe(true);
	});

	it('is hidden when the numeric condition is not met', () => {
		expect(isQuestionVisible(question, {}, { days: 1 })).toBe(false);
	});

	it('is visible without a condition', () => {
		expect(isQuestionVisible({ id: 'x', label: 'X', type: 'toggle' }, {}, {})).toBe(true);
	});
});
