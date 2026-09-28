import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/defaultConfig';
import { validateConditions } from '../src/validate';
import { ChecklistConfig } from '../src/types';

describe('validateConditions', () => {
	it('accepts the built-in config', () => {
		expect(validateConditions(DEFAULT_CONFIG)).toHaveLength(0);
	});

	it('reports conditions referencing unknown questions or values', () => {
		const config: ChecklistConfig = {
			questions: [],
			sections: [
				{
					id: 'broken',
					title: 'Broken',
					includeWhen: { question: 'nonexistent', equals: 'yes' },
					items: ['Item'],
				},
			],
		};
		const errors = validateConditions(config);
		expect(errors.some((e) => e.includes('unknown question or value "nonexistent"'))).toBe(true);
	});

	it('accepts computed values in greaterThan conditions', () => {
		const config: ChecklistConfig = {
			questions: [],
			computed: [{ name: 'days', expression: 'return - departure' }],
			sections: [
				{
					id: 'long',
					title: 'Long absence',
					includeWhen: { question: 'days', greaterThan: '7' },
					items: ['Item'],
				},
			],
		};
		expect(validateConditions(config)).toHaveLength(0);
	});

	it('rejects greaterThan on non-numeric questions', () => {
		const config: ChecklistConfig = {
			questions: [
				{
					id: 'transport',
					label: 'Transport',
					type: 'select',
					options: [{ id: 'car', label: 'Car' }],
				},
			],
			sections: [
				{
					id: 'broken',
					title: 'Broken',
					includeWhen: { question: 'transport', greaterThan: '7' },
					items: ['Item'],
				},
			],
		};
		const errors = validateConditions(config);
		expect(errors.some((e) => e.includes('cannot be compared with greaterThan'))).toBe(true);
	});

	it('reports invalid answer ids for select questions', () => {
		const config: ChecklistConfig = {
			questions: [
				{
					id: 'transport',
					label: 'Transport',
					type: 'select',
					options: [{ id: 'car', label: 'Car' }],
				},
			],
			sections: [
				{
					id: 'broken',
					title: 'Broken',
					includeWhen: { question: 'transport', equals: 'teleport' },
					items: ['Item'],
				},
			],
		};
		const errors = validateConditions(config);
		expect(errors.some((e) => e.includes('"teleport"'))).toBe(true);
	});

	it('accepts yes/no answers for toggles', () => {
		const config: ChecklistConfig = {
			questions: [{ id: 'pets', label: 'Pets', type: 'toggle' }],
			sections: [
				{
					id: 'pets-section',
					title: 'Pet care',
					includeWhen: { question: 'pets', equals: 'yes' },
					items: [{ text: 'Food', when: { question: 'pets', equals: 'no' } }],
				},
			],
		};
		expect(validateConditions(config)).toHaveLength(0);
	});

	it('reports items with invalid template expressions', () => {
		const config: ChecklistConfig = {
			questions: [],
			sections: [
				{
					id: 'templates',
					title: 'Templates',
					items: ['Pack {ceil(days / 2)} shirts', 'Pack {days +} socks'],
				},
			],
		};
		const errors = validateConditions(config);
		expect(errors.some((e) => e.includes('invalid expression "{days +}"'))).toBe(true);
		expect(errors.some((e) => e.includes('invalid expression "{ceil(days / 2)}"'))).toBe(false);
	});

	it('reports computed values with invalid expressions', () => {
		const config: ChecklistConfig = {
			questions: [],
			computed: [{ name: 'days', expression: 'return -' }],
			sections: [],
		};
		const errors = validateConditions(config);
		expect(errors.some((e) => e.includes('Computed value "days"'))).toBe(true);
	});

	it('reports items without text', () => {
		const config: ChecklistConfig = {
			questions: [],
			sections: [
				{
					id: 'empty-item',
					title: 'Empty item',
					items: [{ when: { question: 'x', equals: 'yes' } } as never],
				},
			],
		};
		const errors = validateConditions(config);
		expect(errors.some((e) => e.includes('missing text'))).toBe(true);
	});
});
