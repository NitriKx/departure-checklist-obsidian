import { describe, expect, it } from 'vitest';
import { buildChecklistMarkdown, includedSections } from '../src/builder';
import { DEFAULT_CONFIG } from '../src/defaultConfig';
import { Answers } from '../src/types';

function baseAnswers(): Answers {
	return {
		tripType: 'vacation',
		departure: '2026-09-27',
		return: '2026-10-01', // 4 days
		transport: 'car',
		kids: 'no',
		pets: 'no',
		season: 'mild',
	};
}

describe('includedSections', () => {
	it('includes always-on sections and drops conditional ones', () => {
		const sections = includedSections(DEFAULT_CONFIG, baseAnswers());
		const ids = sections.map(({ section }) => section.id);
		expect(ids).toContain('documents-money');
		expect(ids).toContain('home-security');
		expect(ids).not.toContain('work-items');
		expect(ids).not.toContain('kids-items');
		expect(ids).not.toContain('transport-plane');
		expect(ids).toContain('transport-car');
		expect(ids).not.toContain('long-absence');
	});

	it('adds sections matching the answers', () => {
		const answers = { ...baseAnswers(), tripType: 'work', kids: 'yes', transport: 'plane' };
		const ids = includedSections(DEFAULT_CONFIG, answers).map(({ section }) => section.id);
		expect(ids).toContain('work-items');
		expect(ids).toContain('kids-items');
		expect(ids).toContain('transport-plane');
		expect(ids).not.toContain('transport-car');
	});

	it('includes long-absence sections only past 7 days', () => {
		const shortTrip = includedSections(DEFAULT_CONFIG, baseAnswers());
		expect(shortTrip.map(({ section }) => section.id)).not.toContain('long-absence');

		const longTrip = includedSections(DEFAULT_CONFIG, {
			...baseAnswers(),
			return: '2026-10-07', // 10 days
		});
		const ids = longTrip.map(({ section }) => section.id);
		expect(ids).toContain('long-absence');
		const home = longTrip.find(({ section }) => section.id === 'home-security');
		expect(home?.items.map((item) => item.text)).toContain('Empty the fridge of perishables');
	});

	it('filters items inside a section by their when condition', () => {
		const summer = includedSections(DEFAULT_CONFIG, { ...baseAnswers(), season: 'summer' });
		const clothing = summer.find(({ section }) => section.id === 'clothing-toiletries');
		expect(clothing?.items.map((item) => item.text)).toContain('Sunscreen and sunglasses');

		const winter = includedSections(DEFAULT_CONFIG, { ...baseAnswers(), season: 'winter' });
		const clothingWinter = winter.find(
			({ section }) => section.id === 'clothing-toiletries',
		);
		expect(clothingWinter?.items.map((item) => item.text)).not.toContain(
			'Sunscreen and sunglasses',
		);
		expect(clothingWinter?.items.map((item) => item.text)).toContain(
			'Warm coat, gloves, and hat',
		);
	});
});

describe('buildChecklistMarkdown', () => {
	it('renders a dated heading, section headings, and checkboxes', () => {
		const markdown = buildChecklistMarkdown(DEFAULT_CONFIG, baseAnswers(), '2026-09-27');
		expect(markdown).toContain('# Departure checklist - 2026-09-27');
		expect(markdown).toContain('## Documents and money');
		expect(markdown).toMatch(/- \[ \] Wallet - cash, bank cards, ID/);
	});

	it('computes item counts from the trip length', () => {
		const fourDays = buildChecklistMarkdown(DEFAULT_CONFIG, baseAnswers(), '2026-09-27');
		expect(fourDays).toContain('- [ ] Pack at least 4 pairs of underwear and socks');
		expect(fourDays).toContain('- [ ] Pack at least 2 t-shirts or shirts');
		expect(fourDays).toContain('- [ ] Medication for 4 days');

		const fiveDays = buildChecklistMarkdown(
			DEFAULT_CONFIG,
			{ ...baseAnswers(), return: '2026-10-02' },
			'2026-09-27',
		);
		expect(fiveDays).toContain('- [ ] Pack at least 3 t-shirts or shirts');
	});

	it('falls back to ? for computed counts when dates are missing', () => {
		const { departure, return: back, ...withoutDates } = baseAnswers();
		expect(withoutDates.departure).toBeUndefined();
		const markdown = buildChecklistMarkdown(DEFAULT_CONFIG, withoutDates, '2026-09-27');
		expect(markdown).toContain('- [ ] Pack at least ? pairs of underwear and socks');
	});

	it('adapts to work + plane answers', () => {
		const markdown = buildChecklistMarkdown(
			DEFAULT_CONFIG,
			{ ...baseAnswers(), tripType: 'work', transport: 'plane' },
			'2026-09-27',
		);
		expect(markdown).toContain('## Work items');
		expect(markdown).toContain('## Plane travel');
		expect(markdown).toContain('- [ ] Passport or national ID card');
		expect(markdown).not.toContain('## Vacation items');
	});
});
