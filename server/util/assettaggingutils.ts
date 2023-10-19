export const SEMANTIC_UI_COLORS = [
  "#B03060",
  "#FE9A76",
  "#FFD700",
  "#32CD32",
  "#016936",
  "#008080",
  "#0E6EB8",
  "#EE82EE",
  "#B413EC",
  "#FF1493",
  "#A52A2A",
];

export const getRandomColor = (): string => {
  return SEMANTIC_UI_COLORS[
    Math.floor(Math.random() * SEMANTIC_UI_COLORS.length)
  ];
};