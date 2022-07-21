import * as fs from 'fs-extra';
import * as path from 'path';
import * as glob from 'glob';

const artifactPath = path.resolve(__dirname, '../../cask-contracts/artifacts/contracts/interfaces');
const outputPath = path.resolve(__dirname, '../abis');


const abiJSONfilenames = {
    'ICaskVault.json': 'CaskVault.json',
    'ICaskSubscriptions.json': 'CaskSubscriptions.json',
    'ICaskSubscriptionPlans.json': 'CaskSubscriptionPlans.json',
    'ICaskDCA.json': 'CaskDCA.json',
    'ICaskP2P.json': 'CaskP2P.json',
};

glob(artifactPath + '/**/!(*dbg).json', {}, (err, files) => {
    if (err) {
        console.error(err);
    }
    for (const filename of files) {
        const split = filename.split('/');
        const contractName = split[split.length - 1];
        const outputName = abiJSONfilenames[contractName];
        if (outputName) {
            console.log(`Writing contract ${contractName} to ${outputPath+'/'+outputName}`);
            const abi = JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8')).abi;
            fs.writeFileSync(outputPath + '/' + outputName, JSON.stringify(abi, null, 2));
        }
    }
});
