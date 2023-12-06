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

export function sortXByOrderOfY<T, K>(x: T[], y: K[]): T[] {
  // Create a map of elements in array Y to their indices
  const mapY = new Map();
  y.forEach((element, index) => {
    mapY.set(element, index);
  });

  // Sort array X based on the order in array Y
  x.sort((a, b) => {
    const indexA = mapY.has(a) ? mapY.get(a) : Infinity;
    const indexB = mapY.has(b) ? mapY.get(b) : Infinity;
    return indexA - indexB;
  });

  return x;
}
