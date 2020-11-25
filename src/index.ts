import {promisify} from 'util';
import {createInterface} from 'readline';
import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';

const WARRIORS_NUMBER = 100;

const { stdin: input, stdout: output } = process;
const stdio = createInterface({ input, output });

type Matrix = number[][];

// @ts-ignore
stdio.question[promisify.custom] = (question: string) => new Promise(resolve => stdio.question(question, resolve));
const question = async (question: string) => <string> <unknown> (await promisify(stdio.question)(question));
const exit = () => process.exit(0);

interface Limits  {
    min: number;
    max: number;
}

const round = (num: number, decimals: number): number => {
    const factorOfTen = Math.pow(10, decimals);

    return Math.round(num * factorOfTen) / factorOfTen;
}

const generateFloat = ({ min, max }: Limits) => (Math.random() * (max - min)) + min;

const shuffle = (row: number[]): number[] => {
    let currentIndex = row.length, temporaryValue, randomIndex;

    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        temporaryValue = row[currentIndex];
        row[currentIndex] = row[randomIndex];
        row[randomIndex] = temporaryValue;
    }

    return row;
}

const insertAt = <Type>(arr: Type[], index: number, element: Type): Type[] =>
    [...arr.slice(0, index), element, ...arr.slice(index)];

const generateRow = (size: number, position: number): number[] => {
    let row: number[] = [];
    const generatedElements = size - 1;

    let max = 1;
    for (let i = 0; i < generatedElements; i++) {
        const element = (i === generatedElements - 1) ? max : generateFloat({ min: 0, max });
        const cell = round(element, 3);

        max -= cell;

        row.push(cell);
    }

    row = shuffle(row);

    return insertAt(row, position, 0);
};

const generateMatrix = (size: number): Matrix => {
    const matrix: Matrix = [];

    for (let i = 0; i < size; i++) {
        matrix[i] = generateRow(size, i);
    }

    return matrix;
};

interface Faction {
    name: string;
    warriors: number;
}

const generateFactions = (factionsNum: number): Faction[] => {
    const factions: Faction[] = [];
    for (let i = 0; i < factionsNum; i++) {
        factions.push({ name: `${ i }`, warriors: WARRIORS_NUMBER });
    }

    return factions;
};

interface Probability {
    limits: Limits;
    index: number;
}

const generateProbabilities = (size: number, matrix: Matrix): Probability[][] => {
    return matrix.map((row, index) => {
        const probabilities: Probability[] = [];

        let min = 0;
        for (let i = 0; i < size; i++) {
            const max = min + row[i];

            if (i !== index) {
                probabilities.push({ limits: { min, max }, index: i });
            }

            min = max;
        }

        return probabilities;
    });
};

const getDefender = (attacker: number, probabilities: Probability[]) => {
    const probability = round(Math.random(), 3);

    return probabilities.filter(({ limits }) =>
        (probability >= limits.min && probability <= limits.max))[0].index;
}

interface StatepPobabilities {
    [key: string]: {
        probability: number;
        kills: number;
    }
}

interface StageData {
    remainingWarriors: number;
    probabilities: StatepPobabilities;
}

interface Statistics {
    [key: string]: {
        stages: StageData[]
    }
}

const generateStatistics = (total: number, factions: Faction[], matrix: Matrix, cache: Statistics) => {
    for (let i = 0; i < total; i++) {
        const { name, warriors } = factions[i];

        if (!cache[name]) {
            cache[name] = { stages: [] };
        }

        const totalOptions = total - 1;
        const options = factions.filter(faction => faction.name !== name);
        const probabilities = matrix[i].filter(column => column !== 0);

        const stageData: StatepPobabilities = {};
        for (let j = 0; j < totalOptions; j++) {
            const probability = probabilities[j] * 100;

            stageData[options[j].name] = { probability, kills: 0 };
        }

        cache[name].stages.push({
            remainingWarriors: warriors,
            probabilities: stageData
        });
    }
};

const writeFile = (faction: string, stages: StageData[]) => {
    const file = path.resolve(__dirname, `./output/faction_${ faction }.json`);

    fs.writeFileSync(file, JSON.stringify({ stages }, null, 2));
};

(async () => {
    rimraf.sync(path.resolve(__dirname, './output'));

    let factionsNum = Number(await question('Give the number of factions: '));

    if (isNaN(factionsNum) || !Number.isInteger(factionsNum) || factionsNum < 2) {
        console.log(`The number of factions must be an integer number >= 2.`);
        exit();
    }

    const statistics: Statistics = {};

    let matrix = generateMatrix(factionsNum);
    let probabilities = generateProbabilities(factionsNum, matrix);
    const factions = generateFactions(factionsNum);
    generateStatistics(factionsNum, factions, matrix, statistics);

    let stage = 0;
    while (factionsNum !== 1) {
        const attacker = Math.floor(Math.random() * factionsNum);
        const probability = probabilities[attacker];
        const defender = getDefender(attacker, probability);

        const attackFaction = factions[attacker].name;
        const defenderFaction = factions[defender];
        defenderFaction.warriors--;

        statistics[attackFaction].stages[stage].probabilities[defenderFaction.name].kills++;
        if (defenderFaction.warriors === 0) {
            factionsNum--;
            stage++;

            matrix = generateMatrix(factionsNum);
            probabilities = generateProbabilities(factionsNum, matrix);
            factions.splice(defender, 1);
            generateStatistics(factionsNum, factions, matrix, statistics);
        }
    }

    fs.mkdirSync(path.resolve(__dirname, './output'));
    for (const [faction, { stages }] of Object.entries(statistics)) {
        writeFile(faction, stages);
    }

    console.log(`The faction number ${ factions[0].name } wins`);

    exit();
})()
