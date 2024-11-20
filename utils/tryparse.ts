import { Convert } from "../src/ConfigurationEntry.mjs";

import * as fs from 'fs';

// Read the file synchronously
const filePath = '../sample.json';
const fileContent: string = fs.readFileSync(filePath, 'utf8');

const homeData = Convert.toConfigurationEntry(fileContent);

console.log("Home Info: " + JSON.stringify(homeData, null, 2));