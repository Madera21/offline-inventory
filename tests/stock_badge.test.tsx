import React from 'react';
import { StockBadge } from '../src/components/StockBadge';
const { act, create } = require('react-test-renderer');

test.each([[10, '10/10'], [9, '9/10'], [0, '0/10']])('shows %s remaining against the stocked total, including zero', async (quantity, expected) => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let tree: any;
  await act(async () => { tree = create(<StockBadge quantity={quantity as number} totalStocked={10} unitLabel="pieces" />); });
  expect(JSON.stringify(tree.toJSON())).toContain(expected);
  await act(async () => tree.unmount());
});
