import { describe, expect, it } from 'vitest';

import { detectOpenApiVersion } from '../src/lib/spec/detect-version.js';

describe('detectOpenApiVersion', () => {
  describe('JSON input', () => {
    it('detects 3.0 from JSON spec (3.0.3)', () => {
      expect(detectOpenApiVersion('{"openapi":"3.0.3","info":{"title":"T","version":"1"},"paths":{}}')).toBe('3.0');
    });

    it('detects 3.1 from JSON spec (3.1.0)', () => {
      expect(detectOpenApiVersion('{"openapi":"3.1.0","info":{"title":"T","version":"1"},"paths":{}}')).toBe('3.1');
    });
  });

  describe('YAML input', () => {
    it('detects 3.0 from YAML spec (3.0.3)', () => {
      expect(detectOpenApiVersion('openapi: 3.0.3\ninfo:\n  title: T\n  version: "1"\npaths: {}')).toBe('3.0');
    });

    it('detects 3.1 from YAML spec (3.1.0)', () => {
      expect(detectOpenApiVersion('openapi: 3.1.0\ninfo:\n  title: T\n  version: "1"\npaths: {}')).toBe('3.1');
    });
  });

  describe('version normalisation', () => {
    it('strips patch segment from JSON version (3.0.3 → 3.0)', () => {
      expect(detectOpenApiVersion('{"openapi":"3.0.3"}')).toBe('3.0');
    });

    it('strips patch segment from JSON version (3.1.0 → 3.1)', () => {
      expect(detectOpenApiVersion('{"openapi":"3.1.0"}')).toBe('3.1');
    });

    it('handles already-normalised version (3.1 → 3.1)', () => {
      expect(detectOpenApiVersion('{"openapi":"3.1"}')).toBe('3.1');
    });

    it('handles YAML with quoted version string ("3.1.0")', () => {
      expect(detectOpenApiVersion('openapi: "3.1.0"\ninfo:\n  title: Test')).toBe('3.1');
    });

    it("handles YAML with single-quoted version string ('3.1.0')", () => {
      expect(detectOpenApiVersion("openapi: '3.1.0'\ninfo:\n  title: Test")).toBe('3.1');
    });
  });

  describe('safe defaults', () => {
    it('defaults to 3.0 for unrecognised content', () => {
      expect(detectOpenApiVersion('not a spec')).toBe('3.0');
    });

    it('defaults to 3.0 for empty string', () => {
      expect(detectOpenApiVersion('')).toBe('3.0');
    });

    it('defaults to 3.0 for swagger 2.0 content', () => {
      expect(detectOpenApiVersion('{"swagger":"2.0","info":{"title":"Old API"}}')).toBe('3.0');
    });

    it('defaults to 3.0 when openapi field is a number, not a string', () => {
      // Some tools incorrectly emit openapi: 3.1 (unquoted number in JSON)
      expect(detectOpenApiVersion('{"openapi":3.1,"info":{"title":"Bad"}}')).toBe('3.0');
    });
  });
});
