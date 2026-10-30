import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const asset = name => fileURLToPath(new URL('../../client/public/sounds/' + name, import.meta.url));
test('gravação dos dados foi incluída como MP3 reproduzível', () => {
  const path = asset('dice.mp3');
  const data = readFileSync(path);
  assert.ok(data.length > 2000);
  assert.equal(data.subarray(0,3).toString('ascii'), 'ID3');
  const check = spawnSync('ffmpeg', ['-v','error','-xerror','-i',path,'-f','null','-'], {encoding:'utf8'});
  if (check.error?.code !== 'ENOENT') {
    assert.equal(check.status, 0, check.stderr);
  }
});
test('novos efeitos WAV possuem cabeçalhos e dados PCM válidos', () => {
  for (const name of ['seven','milestone','victory']) {
    const data = readFileSync(asset(name + '.wav'));
    assert.ok(data.length > 10000);
    assert.equal(data.subarray(0,4).toString('ascii'), 'RIFF');
    assert.equal(data.subarray(8,12).toString('ascii'), 'WAVE');
    assert.equal(data.readUInt32LE(40) + 44, data.length);
    const duration = data.readUInt32LE(40) / (data.readUInt32LE(24) * 2);
    assert.ok(duration < 1.6, `${name} deve ser um efeito curto, não uma fanfarra longa`);
  }
});
