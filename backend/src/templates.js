const templates = [
  {
    id: "pythagorean-theorem",
    title: "Pythagorean theorem",
    matchers: [
      "pythagorean",
      "pytagore",
      "pytago",
      "pitago",
      "py-ta-go",
      "tam giac vuong",
      "right triangle",
    ],
    captionTimings: [0, 4, 8, 12],
    storyboard: [
      "Draw a right triangle and label the two short sides a and b.",
      "Label the longest side c, the hypotenuse.",
      "Build one square on each side of the triangle.",
      "Show that the two smaller square areas combine to equal the large square area: a^2 + b^2 = c^2.",
    ],
    videoStyle: "3blue1brown-inspired geometric explainer",
    fallbackLessons: {
      en: {
        opening:
          "Let's look at a right triangle. The square on the long side has the same area as the two smaller squares combined.",
        steps: [
          { atSeconds: 0, text: "Start with a right triangle and name the short sides a and b." },
          { atSeconds: 4, text: "The longest side is c, also called the hypotenuse." },
          { atSeconds: 8, text: "Now build a square on each side." },
          { atSeconds: 12, text: "The two smaller square areas add up to the large square area: a^2 + b^2 = c^2." },
        ],
        followUpQuestion: "Want to try one? If a = 3 and b = 4, what is c?",
      },
      vi: {
        opening:
          "Hãy nhìn vào một tam giác vuông. Hình vuông trên cạnh dài nhất có diện tích bằng tổng hai hình vuông trên hai cạnh ngắn.",
        steps: [
          { atSeconds: 0, text: "Bắt đầu với tam giác vuông và gọi hai cạnh ngắn là a và b." },
          { atSeconds: 4, text: "Cạnh dài nhất là c, còn gọi là cạnh huyền." },
          { atSeconds: 8, text: "Bây giờ dựng một hình vuông trên mỗi cạnh." },
          { atSeconds: 12, text: "Hai diện tích nhỏ cộng lại bằng diện tích lớn: a^2 + b^2 = c^2." },
        ],
        followUpQuestion: "Thử một bài nhé: nếu a = 3 và b = 4, vậy c bằng bao nhiêu?",
      },
    },
  },
];

function searchableText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function findTemplateForPrompt(prompt) {
  const normalized = searchableText(prompt);
  return templates.find((template) =>
    template.matchers.some((matcher) => normalized.includes(searchableText(matcher))),
  );
}

export function getTemplateSummaries() {
  return templates.map(({ id, title, storyboard, videoStyle }) => ({
    id,
    title,
    storyboard,
    videoStyle,
  }));
}
