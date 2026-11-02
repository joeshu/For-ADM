import {readFile} from 'node:fs/promises';
import {validateSiteManifest} from '../Web/source-contract.mjs';

const sites=JSON.parse(await readFile(new URL('../Web/sites.json',import.meta.url),'utf8'));
validateSiteManifest(sites);
console.log(`Validated ${sites.length} bundled source descriptors and adapter configurations.`);
