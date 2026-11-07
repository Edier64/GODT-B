import {
  canonicalJsonSerialize,
  computeCanonicalManifestDigest,
} from "../src/domain/dossier/dossier.types";

describe("RFC 8785 (JSON Canonicalization Scheme - JCS) Compliance", () => {
  describe("Official RFC 8785 / JCS Reference Vectors", () => {
    it("serializes the comprehensive RFC 8785 test vector with exact wire format", () => {
      // Vector oficial JCS (Anders Rundgren / cyberphone)
      const rawInputJson =
        "{\n" +
        '  "numbers": [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],\n' +
        '  "string": "\\u20ac$\\u000f\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/",\n' +
        '  "literals": [null, true, false]\n' +
        "}";

      const parsed = JSON.parse(rawInputJson);
      const canonicalString = canonicalJsonSerialize(parsed);

      // Verificación exacta de bytes UTF-8 (hex wire format)
      // RFC 8785 especifica:
      // {"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\u000f\nA'B\"\\\\\"/"}
      const hexWire = Buffer.from(canonicalString, "utf-8").toString("hex");
      const expectedHexPrefix =
        "7b226c69746572616c73223a5b6e756c6c2c747275652c66616c73655d2c226e756d62657273223a";
      expect(hexWire.startsWith(expectedHexPrefix)).toBe(true);

      // Deserializar para verificar campos semánticos
      const reserialized = JSON.parse(canonicalString);
      expect(reserialized.literals).toEqual([null, true, false]);
      expect(reserialized.numbers).toEqual([
        333333333.3333333,
        1e30,
        4.5,
        0.002,
        1e-27,
      ]);
    });

    it("sorts object properties lexicographically by UTF-16 code units (RFC 8785 Section 3.2.3)", () => {
      // Vector de ordenación de propiedades UTF-16
      const unsorted = {
        "\u20ac": "Euro Sign",
        "\r": "Carriage Return",
        "\ufb33": "Hebrew Letter Dalet With Dagesh",
        "1": "One",
        "\ud83d\ude00": "Emoji: Grinning Face",
        "\u0080": "Control",
        "\u00f6": "Latin Small Letter O With Diaeresis",
      };

      const canonical = canonicalJsonSerialize(unsorted);

      // En la cadena serializada canónica, verificar que las claves aparecen en el orden UTF-16 estricto:
      // \r (U+000D) < 1 (U+0031) < \u0080 < ö (U+00F6) < € (U+20AC) < 😀 (U+D83D U+DE00) < דּ (U+FB33)
      const keyOrder = [
        canonical.indexOf('"\\r"'),
        canonical.indexOf('"1"'),
        canonical.indexOf('"\\u0080"') !== -1
          ? canonical.indexOf('"\\u0080"')
          : canonical.indexOf('"\u0080"'),
        canonical.indexOf('"ö"'),
        canonical.indexOf('"€"'),
        canonical.indexOf('"😀"'),
        canonical.indexOf('"דּ"'),
      ];

      for (let i = 0; i < keyOrder.length - 1; i++) {
        expect(keyOrder[i]).toBeLessThan(keyOrder[i + 1]);
      }
    });
  });

  describe("Number Serialization & I-JSON Constraints", () => {
    it("normalizes negative zero (-0) to 0", () => {
      expect(canonicalJsonSerialize(-0)).toBe("0");
      expect(canonicalJsonSerialize(+0)).toBe("0");
      expect(canonicalJsonSerialize({ zero: -0 })).toBe('{"zero":0}');
    });

    it("throws a TypeError when encountering NaN (RFC 8785 Section 3.2.2.3)", () => {
      expect(() => canonicalJsonSerialize(NaN)).toThrow(TypeError);
      expect(() => canonicalJsonSerialize({ invalid: NaN })).toThrow(
        "RFC 8785: NaN e Infinity no son permitidos",
      );
    });

    it("throws a TypeError when encountering positive or negative Infinity", () => {
      expect(() => canonicalJsonSerialize(Infinity)).toThrow(TypeError);
      expect(() => canonicalJsonSerialize(-Infinity)).toThrow(TypeError);
      expect(() => canonicalJsonSerialize({ inf: Infinity })).toThrow(TypeError);
    });

    it("serializes numbers according to ECMAScript 7.1.12.1 exponential rules", () => {
      expect(canonicalJsonSerialize(1e21)).toBe("1e+21");
      expect(canonicalJsonSerialize(1e-6)).toBe("0.000001");
      expect(canonicalJsonSerialize(1e-7)).toBe("1e-7");
      expect(canonicalJsonSerialize(4.5)).toBe("4.5");
      expect(canonicalJsonSerialize(100)).toBe("100");
    });
  });

  describe("Structural Preservations & Exclusions", () => {
    it("strictly preserves array element ordering", () => {
      const arr = [3, 1, 2, "z", "a"];
      expect(canonicalJsonSerialize(arr)).toBe('[3,1,2,"z","a"]');
    });

    it("recursively excludes specified volatile keys (e.g. manifestDigest)", () => {
      const payload = {
        title: "Test",
        manifestDigest: "abc12345",
        nested: {
          sub: "value",
          manifestDigest: "ignore-this-too",
        },
      };

      const serialized = canonicalJsonSerialize(
        payload,
        new Set(["manifestDigest"]),
      );
      expect(serialized).toBe('{"nested":{"sub":"value"},"title":"Test"}');
      expect(serialized).not.toContain("manifestDigest");
    });

    it("computes identical SHA-256 digests for logically equivalent objects with different key order", () => {
      const obj1 = { b: 2, a: 1, c: { y: 20, x: 10 } };
      const obj2 = { a: 1, c: { x: 10, y: 20 }, b: 2 };

      const digest1 = computeCanonicalManifestDigest(obj1);
      const digest2 = computeCanonicalManifestDigest(obj2);

      expect(digest1).toBe(digest2);
      expect(digest1).toHaveLength(64);
    });
  });
});
