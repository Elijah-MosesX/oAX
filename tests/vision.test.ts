import test from 'node:test';
import assert from 'node:assert/strict';
import {
  visionInput,
  visionOutput,
} from '../deployments/team/shared/vision.js';
test('screen understanding requires exact user approval and bounded images/results', () => {
  assert.throws(() => visionInput({ image: '/9j/AA==', question: 'Explain' }));
  assert.throws(() =>
    visionInput({
      approved: true,
      image: 'https://private/image',
      question: 'Explain',
    }),
  );
  assert.throws(() =>
    visionInput({
      approved: true,
      image: '/9j/' + 'A'.repeat(512000),
      question: 'Explain',
    }),
  );
  assert.equal(
    visionInput({ approved: true, image: '/9j/AA==', question: 'Explain' })
      .question,
    'Explain',
  );
  assert.throws(() =>
    visionOutput({
      summary: 'x',
      observations: Array(9).fill('x'),
      suggestions: [],
      uncertainty: 'Unknown',
    }),
  );
  assert.deepEqual(
    visionOutput({
      summary: 'Error visible',
      observations: ['A red warning'],
      suggestions: ['Inspect logs'],
      uncertainty: 'Source location not established',
    }).suggestions,
    ['Inspect logs'],
  );
});
