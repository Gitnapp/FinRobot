import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observationChanges } from '../../frontend/src/components/macro-observation.ts';
test('CPI uses source changes, including zero, instead of changes in inflation rates',()=>{
 const p={date:'2026-07-01',value:-.1,yoy:.5,mom:0};
 assert.deepEqual(observationChanges([p],p,'%'),{yoy:.5,mom:0,unit:'%',direct:true});
});
test('rate changes compare calendar periods in percentage points; missing period is not substituted',()=>{
 const p=[{date:'2025-07-01',value:3},{date:'2026-06-01',value:4},{date:'2026-07-01',value:3.5}];
 assert.deepEqual(observationChanges(p,p[2],'%'),{yoy:.5,mom:-.5,unit:'个百分点',direct:false});
 assert.equal(observationChanges([p[0],p[2]],p[2],'%').mom,null);
});
