import yaml = require('js-yaml');

import Handlebars = require('handlebars');
import fs = require('fs-extra');
import path = require('path');

const network = process.argv[2] || 'polygon';

const generateAddresses = async (): Promise<void> => {
    const networksFilePath = path.resolve(__dirname, `../addresses/${network}.json`);
    const config = yaml.load(await fs.readFile(networksFilePath, { encoding: 'utf-8' }));
    config['network'] = network;

    const template = fs.readFileSync('addresses.handlebars').toString();
    fs.writeFileSync('src/mappings/helpers/addresses.ts', Handlebars.compile(template)(config));

    // eslint-disable-next-line no-console
    console.log(`🎉 ${network} addresses successfully generated\n`);
};

generateAddresses();