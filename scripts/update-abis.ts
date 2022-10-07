import * as fs from 'fs-extra';
import * as path from 'path';

const artifactPath = path.resolve(__dirname, '../../cask-contracts/artifacts/contracts');
const outputPath = path.resolve(__dirname, '../abis');

const abiJSONfilenames = [
    'vault/CaskVault.sol/CaskVault.json',
    'subscriptions/CaskSubscriptions.sol/CaskSubscriptions.json',
    'subscriptions/CaskSubscriptionPlans.sol/CaskSubscriptionPlans.json',
    'dca/CaskDCA.sol/CaskDCA.json',
    'p2p/CaskP2P.sol/CaskP2P.json',
    'chainlink_topup/CaskChainlinkTopup.sol/CaskChainlinkTopup.json',
];

for (const filename of abiJSONfilenames) {
    const fullPath = `${artifactPath}/${filename}`;
    const split = fullPath.split('/');
    const contractFileName = split[split.length - 1];
    const contractName = contractFileName.split('.json')[0];
    console.log(`Writing ABI for ${contractName} to ${outputPath+'/'+contractName}.json`);
    const json = JSON.parse(fs.readFileSync(path.resolve(fullPath), 'utf8'));
    fs.writeFileSync(outputPath + '/' + contractName+'.json', JSON.stringify(json, null, 2));
}

