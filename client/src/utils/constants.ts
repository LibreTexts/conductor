export const LIBRARIES: {
  href: string;
  shortName: string;
  longName: string;
}[] = [
  {
    href: "https://bio.libretexts.org/",
    shortName: "bio",
    longName: "Biology",
  },
  {
    href: "https://biz.libretexts.org/",
    shortName: "biz",
    longName: "Business",
  },
  {
    href: "https://chem.libretexts.org/",
    shortName: "chem",
    longName: "Chemistry",
  },
  {
    href: "https://eng.libretexts.org/",
    shortName: "eng",
    longName: "Engineering",
  },
  {
    href: "https://espanol.libretexts.org/",
    shortName: "espanol",
    longName: "Español",
  },
  {
    href: "https://geo.libretexts.org/",
    shortName: "geo",
    longName: "Geosciences",
  },
  {
    href: "https://human.libretexts.org/",
    shortName: "human",
    longName: "Humanities",
  },
  {
    href: "https://k12.libretexts.org/",
    shortName: "k12",
    longName: "K12 Education",
  },
  {
    href: "https://math.libretexts.org/",
    shortName: "math",
    longName: "Mathematics",
  },
  {
    href: "https://med.libretexts.org/",
    shortName: "med",
    longName: "Medicine",
  },
  {
    href: "https://phys.libretexts.org/",
    shortName: "phys",
    longName: "Physics",
  },
  {
    href: "https://socialsci.libretexts.org/",
    shortName: "socialsci",
    longName: "Social Science",
  },
  {
    href: "https://stats.libretexts.org/",
    shortName: "stats",
    longName: "Statistics",
  },
  {
    href: "https://workforce.libretexts.org/",
    shortName: "workforce",
    longName: "Workforce",
  },
];

export const CHAT_NOTIFY_OPTS = (
  defaultOnly: boolean,
  onNotifySpecific: () => void
) => {
  // Notify specific cannot be selected as default option
  const notifySpecific = () => {
    if (defaultOnly) return [];
    return [
      {
        key: "specific",
        text: "Notify specific people...",
        value: "specific",
        onClick: onNotifySpecific,
      },
    ];
  };

  return [
    {
      key: "all",
      text: "Notify entire team",
      value: "all",
    },
    ...notifySpecific(),
    {
      key: "none",
      text: `Don't notify anyone`,
      value: "none",
    },
  ];
};


export const COMMONS_MODULES = [
  "books",
  "assets",
  "authors",
  "projects",
  "minirepos",
];