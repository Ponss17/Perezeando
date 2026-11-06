/** Fusiona actividades cantonales en provinces-content.json; quita fauna de provincia (va en filtros). */
import fs from 'node:fs';
import path from 'node:path';
const BASE = process.cwd();
const pcPath = path.join(BASE, 'public', 'data', 'provinces-content.json');
const pc = JSON.parse(fs.readFileSync(pcPath, 'utf8'));
const canton = JSON.parse(fs.readFileSync(path.join(BASE, 'data', 'canton-activities.json'), 'utf8'));

let actItems = 0;
let stripped = 0;
for (const [prov, block] of Object.entries(pc.provinces || {})) {
  if (block.fauna) {
    delete block.fauna;
    stripped++;
  }
}
for (const [prov, block] of Object.entries(canton)) {
  if (!pc.provinces[prov]) continue;
  pc.provinces[prov].activities = {
    note: {
      es: 'Actividades, senderos o fiestas con fuente verificable. Sin horarios ni precios inventados.',
      en: 'Activities, trails or festivals with a verifiable source. No invented hours or prices.',
    },
    items: block.items || [],
  };
  actItems += (block.items || []).length;
}
fs.writeFileSync(pcPath, JSON.stringify(pc));
console.log({ strippedFaunaProvinces: stripped, actItems });
