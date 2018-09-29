let Placer = {
    data: {
        // Значения для day и night
        dayStart: 10,
        nightStart: 22,

        // Массив хранит информацию об оставшейся доступной мощности для каждого часа
        freePowerArray: [],
      
        // Вых. данные
        outputData: {
            shedule: {},
            consumedEnergy: {
                value: 0,
                devices: {}
            },
            notFittedDevices: []
        }
    },
    start: function (inputData) {
        console.time('speedCheck');
        this.data.inputData = inputData

        // Отсортируем девайсы по мощности( за искл. круглосуточных )
        const devices = this.sortDevices(inputData.devices);

        // Уберем переходы через полночь в расценках
        const rates = this.splitMidnightRates(inputData.rates);

        // Запускаем подбор мест для блоков
        return this.startFit(devices, rates);
    },

    // Функция подбора свободного пространства для блоков
    startFit: function (devices, rates) {
        var placedBlock;

        for (oneDevice of devices) {
            // Если получили ненулевое значение - значит место нашлось, делим оставшееся пространство
            (placedBlock = this.startFinding(oneDevice, rates)) && this.pushToOutput(placedBlock);    
        }

        console.log(this.data.outputData)
        console.timeEnd('speedCheck')

        // Тут пушим в массив, который в итоге будем давать как выходные данные
        return this.data.outputData;
    },

    // Возвращает оптимальное расположение блока
    startFinding: function (oneDevice, rates) {
        places = this.findEmptySpaces(oneDevice);
        if(!places.length) {
            // Пуш в массив неразмещенных блоков
            this.pushNotFitted(oneDevice);
            return null;
        }
        return this.findBestPosition(places, oneDevice, rates);
    },

    // Проверяет хватает ли мощности для устройства на каждом x отрезке 
    findEmptySpaces(oneDevice) {
        // Значение на котором ищем свобдное место
        let x = 0;
        const maxPower = this.data.inputData.maxPower
        let goodPlaces = []

        // Второе условие для блоков длинной в 24
        while (x < 24 - oneDevice.duration || x + oneDevice.duration === 24) {

            // Если блок выходит за рамки своего временного промежутка, то пропускаем итерацию
            if (!this.checkTimezone(x, oneDevice)) {
                x++;
                continue;
            }

            // Создаем независимую копию массива
            let tempFreePowerArray = this.data.freePowerArray.slice()
            // Прогоняем через цикл, что бы проверить есть ли на каждой позиции x, которую занимает прибор необходимая мощность
            for (let i = x; i < (x + oneDevice.duration); i++) {
                // Если можем на этом часу добавить мощность устройства - добавляем
                !tempFreePowerArray[i] && (tempFreePowerArray[i] = 0);
                if ((tempFreePowerArray[i] + oneDevice.power) <= maxPower) {
                    tempFreePowerArray[i] += oneDevice.power;

                    // Если это последняя итерация - значит все  часы прошли и запишем блок на этот x
                    if (i === (x + oneDevice.duration - 1)) {
                        // this.data.freePowerArray = tempFreePowerArray
                        goodPlaces.push({
                            x: x,
                            newFreePowerArray: tempFreePowerArray
                        })
                        // console.log(goodPlaces)
                        x++
                        break
                    }
                } else {
                    // Если хотябы один час не прошел, превываем массив
                    x++
                    break
                }
            }
        }

        // Вернем подходящие ячейки
        // console.log(goodPlaces)
        return goodPlaces;
    },

    // Проверим подходит ли x под требуемое время суток для работы
    checkTimezone(x, oneDevice) {
        let dayStart = this.data.dayStart;
        let nightStart = this.data.nightStart;
        if (oneDevice.mode === 'day' && (x < dayStart || x + oneDevice.duration > nightStart)) {
            return false;
        } else if (
            oneDevice.mode === 'night' &&
            ((x + oneDevice.duration > dayStart && x + oneDevice.duration < nightStart) || (x < nightStart && x > dayStart))
        ) {
            return false;
        } else {
            return true;
        }
    },


    findBestPosition(places, oneDevice, rates) {

        let bestX = 0;

        places.forEach((place) => {
            oneDevice.x = place.x
            let currentPositionPrice = this.checkPrice(oneDevice, rates);

            if (!oneDevice.bestPrice || currentPositionPrice < oneDevice.bestPrice) {
                // Запишем лучшие на текущий момент значения в блок
                bestX = place.x
                oneDevice.bestPrice = currentPositionPrice

                this.data.freePowerArray = place.newFreePowerArray;
            }
        });

        oneDevice.x = bestX;
        return oneDevice;
    },

    // Проверска стоимости расположения блока
    checkPrice(oneDevice, rates) {
        let cost = 0;
        rates.forEach((rate) => {
            let thisRateCost = this.checkThisRate(rate, oneDevice);
            if (thisRateCost > 0) {
                cost = cost + thisRateCost;
            }
        });
        return cost;
    },

    checkThisRate(rate, oneDevice) {
        let from = rate.from;
        let to = rate.to;

        if (from <= oneDevice.x && to >= oneDevice.x + oneDevice.duration) {
            // Елемент полностью входит во временной промежуток
            return oneDevice.duration * oneDevice.power / 1000 * rate.value;
        } else if (from <= oneDevice.x && to < oneDevice.x + oneDevice.duration && to > oneDevice.x) {
            // Елемент начинается в этом промежутке
            return (to - oneDevice.x) * oneDevice.power / 1000 * rate.value;
        } else if (from > oneDevice.x && to >= (oneDevice.x + oneDevice.duration) && from < (oneDevice.x + oneDevice.duration)) {
            // Елемент заканчиваемся в промежутке
            return (oneDevice.x + oneDevice.duration - from) * oneDevice.power / 1000 * rate.value;
        } else if (from > oneDevice.x && to < oneDevice.x + oneDevice.duration) {
            // Елемент полностью проходит через этот промежуток
            return (to - from) * oneDevice.power / 1000 * rate.value;
        }
    },

    sortDevices: function (devices) {
        function compareMaxPower(a, b) {
            // 1 - выше b, -1 - выше a
            // Блоки длинной 24 в приоритете, что бы не получилось так, что они не влезли
            if (a.duration === 24) return -1;
            if (b.duration === 24) return 1;
            if (a.power < b.power) return 1;
            if (a.power > b.power) return -1;
        }
        devices.sort(compareMaxPower);
        return devices;
    },

    // Формируем массив с неразмещенными устройствами
    pushNotFitted(device) {
        this.data.outputData.notFittedDevices.push({
            deviceId: device.id
        });

        throw new Error('Невозможно добавить в расписание устройство: ', device.name);
    },

    pushToOutput(block) {
        let outpData = this.data.outputData;

        for (let i = 0; i <= 23; i++) {
            if (!outpData.shedule[i]) outpData.shedule[i] = [];
            // Пушим id прибора если i входит в его время работы
            if (i >= block.x && i < (block.duration + block.x)) {
                outpData.shedule[i].push(block.id);
            }
        }
        // Пишем суммарное энергопотребление
        let valSumStr = (outpData.consumedEnergy.value + block.bestPrice).toFixed(3);
        outpData.consumedEnergy.value = parseFloat(valSumStr);

        // Пушим само устройство в массив c суммарным энергопотреблением
        outpData.consumedEnergy.devices[block.id] = parseFloat(block.bestPrice.toFixed(3));

    },

    splitMidnightRates(rates) {
        let modifiedRates = [];
        rates.forEach(el => {
            if (el.from < el.to) {
                modifiedRates.push(el);
            } else {
                modifiedRates.push({
                    from: el.from,
                    to: 24,
                    value: el.value
                });
                modifiedRates.push({
                    from: 0,
                    to: el.to,
                    value: el.value
                });
            }
        });

        return modifiedRates;
    },
};


module.exports = Placer;
