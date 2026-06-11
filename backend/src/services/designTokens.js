export const cleanDarkExplainerTokens = {
  theme_id: "clean_dark_explainer",
  canvas: {
    width: 1280,
    height: 720,
    background: "#080c18",
    safe_margin_px: 96,
  },
  typography: {
    title_font: "Inter",
    body_font: "Inter",
    math_font: "Computer Modern",
    title_size: 52,
    label_size: 34,
    caption_size: 28,
  },
  colors: {
    primary: "cyan",
    secondary: "yellow",
    tertiary: "orange",
    success: "green",
    danger: "red",
    neutral: "white",
    muted: "muted",
    background: "dark",
  },
  motion: {
    default_ease: "easeInOutCubic",
    fast_duration: 0.45,
    normal_duration: 0.9,
    slow_duration: 1.6,
    camera_duration: 1.2,
  },
  layout: {
    spacing_unit: 24,
    max_text_lines: 2,
    max_objects_per_shot: 8,
  },
};

export function resolveDesignTokens(stylePreset = "clean_dark_explainer") {
  return {
    ...cleanDarkExplainerTokens,
    theme_id: stylePreset || cleanDarkExplainerTokens.theme_id,
  };
}
