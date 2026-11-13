const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const moduleUnderTest={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/nairobi-date.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(moduleUnderTest,moduleUnderTest.exports);
const {nairobiToday,isCalendarDate}=moduleUnderTest.exports;
assert.equal(nairobiToday(new Date('2026-11-09T22:00:00Z')),'2026-11-10');
assert.equal(nairobiToday(new Date('2026-12-31T21:01:00Z')),'2027-01-01');
assert.equal(nairobiToday(new Date('2026-01-01T00:10:00+03:00')),'2026-01-01');
for(const value of ['2026-02-29','2026-04-31','2026-13-01','0000-01-01','2026-1-01','not-a-date'])assert.equal(isCalendarDate(value),false,value);
for(const value of ['2024-02-29','2000-02-29','2026-11-10'])assert.equal(isCalendarDate(value),true,value);
console.log('PASS: Nairobi day and year boundaries and actual calendar/leap validation.');
