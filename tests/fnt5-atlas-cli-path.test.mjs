import test from "node:test";
import assert from "node:assert/strict";
import {tmpdir} from "node:os";
import {loadExistingEddsDecoder} from "../tools/validate-fnt5-atlas.mjs";

test("EDDS decoder loads outside repository working directory",async()=>{
 const original=process.cwd();
 try {
  process.chdir(tmpdir());
  const decode=await loadExistingEddsDecoder();
  assert.equal(typeof decode,"function");
 }finally {
  process.chdir(original);
 }
});
