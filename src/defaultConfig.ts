import { ChecklistConfig } from './types';

/**
 * Built-in questionnaire and checklist sections. Users can customize
 * them in the plugin settings (questions, computed values, and sections).
 */
export const DEFAULT_CONFIG: ChecklistConfig = {
	questions: [
		{
			id: 'tripType',
			label: 'What kind of trip is it?',
			type: 'select',
			options: [
				{ id: 'work', label: 'Work trip' },
				{ id: 'vacation', label: 'Vacation' },
				{ id: 'moving', label: 'Away from home / moving out' },
			],
		},
		{
			id: 'departure',
			label: 'When do you leave?',
			type: 'date',
			default: 'today',
		},
		{
			id: 'return',
			label: 'When do you come back?',
			type: 'date',
		},
		{
			id: 'transport',
			label: 'How are you traveling?',
			type: 'select',
			options: [
				{ id: 'car', label: 'Car' },
				{ id: 'plane', label: 'Plane' },
				{ id: 'train', label: 'Train or bus' },
				{ id: 'local', label: 'Staying local / other' },
			],
		},
		{
			id: 'kids',
			label: 'Are you traveling with children?',
			type: 'toggle',
			default: 'no',
		},
		{
			id: 'pets',
			label: 'Do you have pets that need care?',
			type: 'toggle',
			default: 'no',
		},
		{
			id: 'season',
			label: 'What is the weather at your destination?',
			type: 'select',
			options: [
				{ id: 'summer', label: 'Hot and sunny' },
				{ id: 'winter', label: 'Cold' },
				{ id: 'rainy', label: 'Rain expected' },
				{ id: 'mild', label: 'Mild / unpredictable' },
			],
		},
	],
	computed: [
		{ name: 'days', expression: 'return - departure' },
	],
	sections: [
		{
			id: 'documents-money',
			title: 'Documents and money',
			items: [
				'Wallet - cash, bank cards, ID',
				'House keys',
				'Tickets, bookings, and reservation confirmations',
				'Insurance card',
				'Emergency contacts written down',
				{
					text: 'Passport or national ID card',
					when: { question: 'transport', equals: 'plane' },
				},
				{
					text: 'Copies of important documents (paper or digital)',
					when: { question: 'transport', equals: 'plane' },
				},
			],
		},
		{
			id: 'electronics',
			title: 'Electronics',
			items: [
				'Phone and charger',
				'Power bank',
				'Headphones',
				{
					text: 'Power plug adapter',
					when: { question: 'transport', equals: 'plane' },
				},
			],
		},
		{
			id: 'clothing-toiletries',
			title: 'Clothing and toiletries',
			items: [
				'Pack at least {days} pairs of underwear and socks',
				'Pack at least {ceil(days / 2)} t-shirts or shirts',
				'Trousers or skirts',
				'Sleepwear',
				'Toothbrush and toothpaste',
				'Deodorant and personal care items',
				'Medication for {days} days',
				'Comfortable walking shoes',
				{
					text: 'Warm coat, gloves, and hat',
					when: { question: 'season', equals: 'winter' },
				},
				{
					text: 'Sunscreen and sunglasses',
					when: { question: 'season', equals: 'summer' },
				},
				{
					text: 'Umbrella and rain jacket',
					when: { question: 'season', equals: 'rainy' },
				},
				{
					text: 'Laundry bag',
					when: { question: 'days', greaterThan: '7' },
				},
			],
		},
		{
			id: 'work-items',
			title: 'Work items',
			includeWhen: { question: 'tripType', equals: 'work' },
			items: [
				'Laptop and charger',
				'Work badge and access cards',
				'Notebook and pens',
				'Business cards',
				'Meeting materials and presentations',
			],
		},
		{
			id: 'vacation-items',
			title: 'Vacation items',
			includeWhen: { question: 'tripType', equals: 'vacation' },
			items: [
				'Book or e-reader',
				'Camera',
				'Daypack for outings',
				'Travel games',
				{
					text: 'Swimsuit',
					when: { question: 'season', equals: 'summer' },
				},
			],
		},
		{
			id: 'kids-items',
			title: 'Children',
			includeWhen: { question: 'kids', equals: 'yes' },
			items: [
				'Snacks and water bottle',
				'Toys or entertainment for the trip',
				'Spare clothes',
				"Children's medication",
				'Stroller or child seat',
			],
		},
		{
			id: 'pets',
			title: 'Pet care',
			includeWhen: { question: 'pets', equals: 'yes' },
			items: [
				'Arrange a pet sitter or boarding',
				'Leave enough food and bowls',
				'Litter box or cage cleaned',
				'Vet contact for the sitter',
				'Walking and feeding instructions',
			],
		},
		{
			id: 'transport-car',
			title: 'Car travel',
			includeWhen: { question: 'transport', equals: 'car' },
			items: [
				'Check fuel level',
				'Check tire pressure',
				'Plan the route and check traffic',
				'Parking arranged at the destination',
				'Toll money or transponder',
				'Car registration and insurance in the car',
			],
		},
		{
			id: 'transport-plane',
			title: 'Plane travel',
			includeWhen: { question: 'transport', equals: 'plane' },
			items: [
				'Check in online',
				'Liquids under 100ml in a clear bag',
				'Respect baggage weight limits',
				'Arrive at the airport at least 2 hours early',
				'Plan the transfer to and from the airport',
			],
		},
		{
			id: 'transport-train',
			title: 'Train or bus travel',
			includeWhen: { question: 'transport', equals: 'train' },
			items: [
				'Tickets downloaded or printed',
				'Arrive early to find the platform',
				'Check luggage size limits',
			],
		},
		{
			id: 'long-absence',
			title: 'Before a long absence',
			includeWhen: { question: 'days', greaterThan: '7' },
			items: [
				'Bills paid or auto-pay configured',
				'Bank notified if traveling abroad',
				'Medication refills enough for the trip',
				'Mail held or collected by someone',
				'Let a neighbor or family member know the dates',
			],
		},
		{
			id: 'home-security',
			title: 'Home before you leave',
			items: [
				'Lock all doors and windows',
				'Close blinds and curtains',
				'Unplug appliances and electronics',
				'Thermostat lowered or heating off',
				'Water the plants',
				'Take out the trash',
				'Lights on a timer or off',
				'Ask a neighbor to collect mail and packages',
				{
					text: 'Empty the fridge of perishables',
					when: { question: 'days', greaterThan: '7' },
				},
				{
					text: 'Shut off the water main',
					when: { question: 'days', greaterThan: '7' },
				},
			],
		},
	],
};
