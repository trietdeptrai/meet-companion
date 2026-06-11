import { describe, expect, test } from "vitest";
import {
  buildConceptGrammarPromptBlock,
  matchConceptGrammar,
} from "../src/services/conceptGrammars.js";

describe("concept visual grammars", () => {
  test.each([
    ["Derivative as local slope", "derivative_local_slope", ["GraphPlot", "GraphLocalZoom", "TangentReveal", "SlopeTriangle"]],
    ["tích phân là diện tích dưới đường cong", "integral_area", ["GraphPlot", "RiemannRectangles", "AreaFillReveal"]],
    ["matrix multiplication as transformation", "matrix_multiplication_transform", ["LinearTransformGrid", "BasisVectorReveal", "VectorTransform"]],
    ["định lý Pythagorean proof", "pythagorean_theorem", ["RightTriangleLabeling", "AreaRearrangementProof", "FormulaReveal"]],
    ["gradient descent for machine learning", "gradient_descent", ["LossLandscape2D", "PointDescent", "StepByStepOptimization"]],
  ])("matches %s to its visual grammar", (prompt, expectedId, requiredComponents) => {
    const grammar = matchConceptGrammar(prompt);

    expect(grammar?.id).toBe(expectedId);
    expect(grammar?.components).toEqual(expect.arrayContaining(requiredComponents));
    expect(grammar?.beats.length).toBeGreaterThanOrEqual(4);
    expect(grammar?.source_refs.length).toBeGreaterThanOrEqual(2);
  });

  test("does not force unrelated concepts into the prepared demo grammars", () => {
    expect(matchConceptGrammar("Euler formula complex exponential")).toBeNull();
  });

  test("builds a compact prompt block with beats, components, formulas, and sources", () => {
    const grammar = matchConceptGrammar("derivative as local slope");
    const block = buildConceptGrammarPromptBlock(grammar);

    expect(block).toContain("Concept visual grammar: Derivative as local slope");
    expect(block).toContain("Required visual beats:");
    expect(block).toContain("GraphLocalZoom");
    expect(block).toContain("f'(a)");
    expect(block).toContain("3Blue1Brown");
  });
});
