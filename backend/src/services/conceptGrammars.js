const conceptGrammars = [
  {
    id: "derivative_local_slope",
    title: "Derivative as local slope",
    aliases: [
      "derivative",
      "local slope",
      "tangent",
      "slope of tangent",
      "dao ham",
      "toc do thay doi tuc thoi",
    ],
    components: ["GraphPlot", "GraphLocalZoom", "TangentReveal", "SlopeTriangle", "FormulaReveal"],
    beats: [
      "Draw one smooth curve and a moving point on it.",
      "Zoom toward the point until the curve visually becomes almost straight.",
      "Reveal the tangent line as the best local straight-line approximation.",
      "Build a small slope triangle on the tangent.",
      "End with the derivative formula as the limit of secant slopes.",
    ],
    formulas: ["f'(a)=lim_{h->0}(f(a+h)-f(a))/h", "dy/dx"],
    visual_rules: [
      "Use one camera zoom as the main wow moment.",
      "Keep labels short: point a, run, rise, slope.",
      "Do not introduce algebra before the tangent intuition is visible.",
    ],
    source_refs: [
      { label: "3Blue1Brown Essence of Calculus", url: "https://www.3blue1brown.com/topics/calculus" },
      { label: "Khan Academy derivative intuition", url: "https://www.khanacademy.org/math/differential-calculus" },
    ],
  },
  {
    id: "integral_area",
    title: "Integral as area",
    aliases: [
      "integral",
      "area under curve",
      "riemann",
      "tich phan",
      "dien tich duoi duong cong",
    ],
    components: ["GraphPlot", "RiemannRectangles", "AreaFillReveal", "FormulaReveal"],
    beats: [
      "Plot a curve above the x-axis with clear bounds a and b.",
      "Grow coarse rectangles under the curve.",
      "Increase rectangle count so the jagged approximation becomes smoother.",
      "Fade the rectangles into one continuous area fill.",
      "End with the definite integral notation.",
    ],
    formulas: ["int_a^b f(x) dx", "lim_{n->infty} sum f(x_i) Delta x"],
    visual_rules: [
      "The rectangle-to-smooth-area transition is the hero motion.",
      "Use color fill for area, not text explanation.",
      "Keep the formula after the area has already appeared.",
    ],
    source_refs: [
      { label: "3Blue1Brown Essence of Calculus", url: "https://www.3blue1brown.com/topics/calculus" },
      { label: "Khan Academy Riemann sums and integrals", url: "https://www.khanacademy.org/math/integral-calculus" },
    ],
  },
  {
    id: "matrix_multiplication_transform",
    title: "Matrix multiplication as transformation",
    aliases: [
      "matrix multiplication",
      "linear transformation",
      "matrix as transformation",
      "ma tran",
      "phep bien doi tuyen tinh",
      "basis vector",
    ],
    components: ["LinearTransformGrid", "BasisVectorReveal", "VectorTransform", "FormulaReveal"],
    beats: [
      "Start with a grid and the two basis vectors.",
      "Move the basis vectors to their new landing positions.",
      "Deform the whole grid coherently around those new basis vectors.",
      "Transform one sample vector as a combination of the transformed basis.",
      "End with matrix-vector and matrix-matrix notation.",
    ],
    formulas: ["A x", "A B x", "A e_1, A e_2"],
    visual_rules: [
      "The grid must move as one object; do not show isolated arrows only.",
      "Use basis vectors as the explanation anchor.",
      "Make straight lines stay straight after the transformation.",
    ],
    source_refs: [
      { label: "3Blue1Brown Essence of Linear Algebra", url: "https://www.3blue1brown.com/topics/linear-algebra" },
      { label: "MIT OCW Linear Algebra", url: "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/" },
    ],
  },
  {
    id: "pythagorean_theorem",
    title: "Pythagorean theorem",
    aliases: [
      "pythagorean",
      "pythagoras",
      "pytagore",
      "pytago",
      "right triangle",
      "tam giac vuong",
      "a2 b2 c2",
    ],
    components: ["RightTriangleLabeling", "AreaRearrangementProof", "FormulaReveal"],
    beats: [
      "Draw a right triangle and label the legs a and b, hypotenuse c.",
      "Build a square on each side.",
      "Fill the two smaller squares with warm area color.",
      "Rearrange or visually compare their combined area with the large square.",
      "End with a^2 + b^2 = c^2 and one quick 3-4-5 check.",
    ],
    formulas: ["a^2+b^2=c^2", "3^2+4^2=5^2"],
    visual_rules: [
      "Area is the proof; labels should support, not dominate.",
      "Use square areas rather than a purely symbolic derivation.",
      "Make the right angle visible from the first geometry shot.",
    ],
    source_refs: [
      { label: "Khan Academy Pythagorean theorem", url: "https://www.khanacademy.org/math/geometry/hs-geo-trig" },
      { label: "Cut-the-Knot Pythagorean proof collection", url: "https://www.cut-the-knot.org/pythagoras/" },
    ],
  },
  {
    id: "gradient_descent",
    title: "Gradient descent",
    aliases: [
      "gradient descent",
      "loss landscape",
      "optimization",
      "machine learning training",
      "toi uu",
      "giam gradient",
    ],
    components: ["LossLandscape2D", "PointDescent", "StepByStepOptimization", "FormulaReveal"],
    beats: [
      "Show loss as height on a smooth landscape or valley curve.",
      "Place the current parameters as a point high on the landscape.",
      "Reveal the gradient as the uphill direction.",
      "Step in the opposite direction, then repeat with smaller steps.",
      "End with the update rule and the learning-rate intuition.",
    ],
    formulas: ["theta_{t+1}=theta_t-eta grad L(theta_t)", "new = old - learning_rate * gradient"],
    visual_rules: [
      "The direction reversal is the core intuition: gradient points uphill, update goes downhill.",
      "Show multiple steps, not a single jump.",
      "Tie learning rate to step size visually.",
    ],
    source_refs: [
      { label: "3Blue1Brown neural networks and gradient descent", url: "https://www.3blue1brown.com/topics/neural-networks" },
      { label: "MIT OCW Optimization Methods", url: "https://ocw.mit.edu/courses/15-084j-nonlinear-programming-spring-2004/" },
    ],
  },
];

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+*/=<>_\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreAlias(normalizedPrompt, alias) {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return 0;
  if (normalizedPrompt === normalizedAlias) return 4;
  if (normalizedPrompt.includes(normalizedAlias)) return Math.min(3, Math.max(1.5, normalizedAlias.split(" ").length));
  return normalizedAlias
    .split(" ")
    .filter((token) => token.length > 3 && normalizedPrompt.includes(token))
    .length * 0.45;
}

export function matchConceptGrammar(prompt) {
  const normalizedPrompt = normalizeText(prompt);
  if (!normalizedPrompt) return null;

  const [best] = conceptGrammars
    .map((grammar) => ({
      grammar,
      score: grammar.aliases.reduce((sum, alias) => sum + scoreAlias(normalizedPrompt, alias), 0),
    }))
    .sort((a, b) => b.score - a.score);

  return best?.score >= 1.5 ? best.grammar : null;
}

export function listConceptGrammars() {
  return conceptGrammars;
}

export function buildConceptGrammarPromptBlock(grammar) {
  if (!grammar) return "";

  return [
    `Concept visual grammar: ${grammar.title}`,
    `Grammar id: ${grammar.id}`,
    `Recommended native components: ${grammar.components.join(", ")}`,
    "Required visual beats:",
    ...grammar.beats.map((beat, index) => `${index + 1}. ${beat}`),
    `Formula targets: ${grammar.formulas.join("; ")}`,
    "Visual rules:",
    ...grammar.visual_rules.map((rule) => `- ${rule}`),
    `Reference sources: ${grammar.source_refs.map((source) => `${source.label} (${source.url})`).join("; ")}`,
    "Use this as a concept grammar, not as a fixed template. Adapt shot wording and props to the learner prompt.",
  ].join("\n");
}
