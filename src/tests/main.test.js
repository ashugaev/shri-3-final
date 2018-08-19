let Placer = require('../main');


test('sortDevices - Сортировка устройств по мощности с приоритетом на длительность в 24 часа', () => {
	const devices = [{
			id: '1',
			power: 500,
			duration: 3
		},
		{
			id: '3',
			power: 150,
			duration: 3
		},
		{
			id: '4',
			power: 50,
			duration: 24
		},
		{
			id: '2',
			power: 350,
			duration: 3
		}
	];
	console.log(Placer);
	const result = Placer.sortDevices(devices);
	expect([result[0].id, result[1].id, result[2].id, result[3].id]).toEqual(['4', '1', '2', '3']);
});

test('splitMidnightRates - Разбиение переходов через полночь на значения до полуночи и после', () => {
	const rates = [{
			from: 7,
			to: 1
		},
		{
			from: 10,
			to: 5
		},
		{
			from: 17,
			to: 6
		}
	];

	const result = Placer.splitMidnightRates(rates);
	expect(result).toHaveLength(6);
	expect([result[0].to, result[1].from]).toEqual([24, 0]);
});

test('pushToOutput - Пуш размещенного блока в объект с выходными значениями', () => {
	const block = {
		bestPrice: 5.398,
		duration: 3,
		id: '0',
		x: 3
	};
	const block2 = {
		bestPrice: 7.398,
		duration: 3,
		id: '1',
		x: 3
	};

	Placer.pushToOutput(block);
	const result = Placer.data.outputData;
	expect([result.shedule[2], result.shedule[3], result.shedule[5], result.shedule[6]]).toEqual([
		[],
		['0'],
		['0'],
		[]
	]);

	Placer.pushToOutput(block2);

	expect([result.consumedEnergy.value, result.consumedEnergy.devices['1']]).toEqual([12.796, 7.398]);
});

describe('checkTimezone - проверка вхождения прибора в определенную ему временную зону', () => {

	Placer.checkTimezone.mockRestore

	const block1 = {
		mode: 'day',
		duration: 3
	};
	const block2 = {
		mode: 'night',
		duration: 2
	};
	const block3 = {
		duration: 7
	};

	Placer.data.dayStart = 10;
	Placer.data.nightStart = 22;

	test('Определение промежутка mode: day', () => {
		let x = 9;
		let result = Placer.checkTimezone(x, block1);
		console.log(x, block1, result)
		expect(result).toEqual(false);

		x = 10;
		result = Placer.checkTimezone(x, block1);
		expect(result).toEqual(true);

		x = 19;
		result = Placer.checkTimezone(x, block1);
		expect(result).toEqual(true);

		x = 20;
		result = Placer.checkTimezone(x, block1);
		expect(result).toEqual(false);
	});

	test('Определение промежутка mode: night', () => {
		let x = 9;
		let result = Placer.checkTimezone(x, block2);
		expect(result).toEqual(false);

		x = 8;
		result = Placer.checkTimezone(x, block2);
		expect(result).toEqual(true);

		x = 22;
		result = Placer.checkTimezone(x, block2);
		expect(result).toEqual(true);

		x = 21;
		result = Placer.checkTimezone(x, block2);
		expect(result).toEqual(false);
	});

	test('Расположение прибора без указанного промежутка', () => {
		let x = 7;
		let result = Placer.checkTimezone(x, block3);
		expect(result).toEqual(true);

		x = 16;
		result = Placer.checkTimezone(x, block3);
		expect(result).toEqual(true);
	});
});

describe('findEmptySpaces - подбор подходящих по размеру ячеек для блока', () => {


	Placer.data.inputData = {
		maxPower: 2100
	}
	Placer.data.freePowerArray = []
	const device = {
		power: 300,
		duration: 5
	};

	// Т.к. внутри ф-ции вызывается проверка временной зоны, поставим на нее всегда true
	Placer.checkTimezone = jest.fn();
	Placer.checkTimezone
		.mockReturnValueOnce(false)
		.mockReturnValue(true);

	const result = Placer.findEmptySpaces(device);
	test('Проверка количества возвращаемых вариантов размещения', () => {
		expect(result).toHaveLength(19);
	});
	test('Проверка корректности установки значений', () => {
		expect([result[0].newFreePowerArray[0], result[0].newFreePowerArray[1], result[0].newFreePowerArray[5], result[0].newFreePowerArray[6]]).toEqual([undefined, 300, 300, undefined]);
	})
	
});


test('spacesPricesChecker - лучшее положение для блока для для всех подходящих для него ячеек', () => {
	places = [{
		x: 1
	}, {
		x: 2
	}, {
		x: 3
	}];

	const device = {};

	const rates = '';

	// Вызываемая внутри ф -ция 3 раза возвращает значения лучшего располжения в каждом отдельном блоке
	Placer.checkPrice = jest.fn();
	Placer.checkPrice
		.mockReturnValueOnce(10)
		.mockReturnValueOnce(15)
		.mockReturnValueOnce(45);

	const result = Placer.findBestPosition(places, device, rates);
	expect(result).toMatchObject({
		x: 1,
		bestPrice: 10
	});
});