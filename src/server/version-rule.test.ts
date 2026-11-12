import { describe, expect, it } from 'vitest';
import { newerVersionOf } from './version-rule.js';

// Unit tests of the version rule, plan-update_check/REQ-4.
describe('newerVersionOf', () => {
  it.each([
    ['v0.2.0', '0.1.0', '0.2.0'],
    ['0.2.0', '0.1.0', '0.2.0'],
    ['v1.0.0', '0.9.9', '1.0.0'],
    ['v0.1.1', '0.1.0', '0.1.1'],
    ['v0.10.0', '0.9.0', '0.10.0'],
    ['v2.0.10', '2.0.9', '2.0.10'],
  ])('gives the version without the v when %s is higher than %s', (tag, installed, expected) => {
    expect(newerVersionOf(tag, installed)).toBe(expected);
  });

  it('gives null for the same version', () => {
    expect(newerVersionOf('v0.1.0', '0.1.0')).toBeNull();
  });

  it.each([
    ['v0.0.9', '0.1.0'],
    ['v0.9.0', '0.10.0'],
    ['v1.9.9', '2.0.0'],
    ['v1.2.2', '1.2.3'],
  ])('gives null when %s is lower than %s', (tag, installed) => {
    expect(newerVersionOf(tag, installed)).toBeNull();
  });

  it('decides on the first part that differs', () => {
    expect(newerVersionOf('v1.0.0', '0.99.99')).toBe('1.0.0');
    expect(newerVersionOf('v0.1.99', '0.2.0')).toBeNull();
  });

  it.each([
    'v0.2.0-rc.1',
    'v0.2.0+build.5',
    'v0.2',
    'v0.2.0.1',
    '',
    'v',
    'vv0.2.0',
    'release-0.2.0',
    'v0.2.x',
  ])('gives null for the tag %j, which is not MAJOR.MINOR.PATCH', (tag) => {
    expect(newerVersionOf(tag, '0.1.0')).toBeNull();
  });

  it.each(['0.1.0-beta', '0.1', '0.1.0.0', '', 'x.y.z'])('gives null when the installed version %j is not MAJOR.MINOR.PATCH', (installed) => {
    expect(newerVersionOf('v9.0.0', installed)).toBeNull();
  });
});
