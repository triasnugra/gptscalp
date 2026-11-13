import fs from 'node:fs';
import {verifyJournal} from '../src/forward.mjs';
const file='data/journal.json';const rows=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];
const r=verifyJournal(rows);console.log(JSON.stringify(r,null,2));if(!r.ok)process.exit(1);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### MetaScalp forward journal\n- Signals: ${r.count}\n- Chain head: \`${r.head||'empty'}\`\n- Integrity: ${r.ok?'OK':'FAILED'}\n`);
