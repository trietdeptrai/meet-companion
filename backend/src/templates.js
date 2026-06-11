const defaultCaptionTimings = [0, 2, 4, 6];

function searchableText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugifyConcept(prompt) {
  const normalized = searchableText(prompt)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized.slice(0, 48) || "visual-math-concept";
}

function inferVisualKind(prompt) {
  const normalized = searchableText(prompt);

  if (
    normalized.includes("toa do") ||
    normalized.includes("coordinate") ||
    normalized.includes("decartes") ||
    normalized.includes("descartes") ||
    normalized.includes("truc x") ||
    normalized.includes("truc y")
  ) {
    return "coordinate-plane";
  }

  if (
    normalized.includes("tam giac") ||
    normalized.includes("pythag") ||
    normalized.includes("pytag") ||
    normalized.includes("pitago")
  ) {
    return "geometry-proof";
  }

  return "abstract-math";
}

function fallbackLesson(prompt, language) {
  if (language === "vi") {
    return {
      opening: `Ta sẽ nhìn "${prompt}" như một ý tưởng toán học trực quan thay vì chỉ là định nghĩa.`,
      steps: [
        { atSeconds: 0, text: "Bắt đầu bằng một khung hình đơn giản để thấy các đối tượng chính." },
        { atSeconds: 2, text: "Tô sáng từng phần quan trọng để thấy chúng liên hệ với nhau." },
        { atSeconds: 4, text: "Biến đổi hoặc di chuyển hình để lộ ra quy luật bên trong." },
        { atSeconds: 6, text: "Kết thúc bằng ý chính cần nhớ dưới dạng hình ảnh." },
      ],
      followUpQuestion: "Bạn thử nói lại ý chính bằng một câu được không?",
    };
  }

  return {
    opening: `Let's treat "${prompt}" as a visual math idea instead of only a definition.`,
    steps: [
      { atSeconds: 0, text: "Start with a clean scene that shows the main objects." },
      { atSeconds: 2, text: "Highlight one important part at a time." },
      { atSeconds: 4, text: "Move or transform the objects to reveal the relationship." },
      { atSeconds: 6, text: "End on the key idea as a memorable visual takeaway." },
    ],
    followUpQuestion: "Can you restate the key idea in one sentence?",
  };
}

export function createPromptTemplate(prompt, language = "en") {
  const title = prompt.replace(/^giải thích\s+/i, "").trim() || prompt;

  return {
    id: slugifyConcept(prompt),
    title,
    visualKind: inferVisualKind(prompt),
    captionTimings: defaultCaptionTimings,
    storyboard: [
      `Introduce the concept visually: ${prompt}.`,
      "Show the simplest objects or axes needed for the idea.",
      "Animate one relationship or transformation step by step.",
      "End with a compact visual takeaway and a check question.",
    ],
    videoStyle: "3Blue1Brown-like dark canvas, glowing math shapes, smooth geometric explainer",
    fallbackLessons: {
      en: fallbackLesson(prompt, "en"),
      vi: fallbackLesson(prompt, language),
    },
  };
}

export function getTemplateSummaries() {
  return [
    {
      id: "dynamic-prompt-video",
      title: "Dynamic prompt video",
      storyboard: [
        "Use the prompt to generate a short visual lesson.",
        "Render a short MP4 scene from the selected visual style.",
      ],
      videoStyle: "3Blue1Brown-like dynamic visual math explainer",
    },
  ];
}
