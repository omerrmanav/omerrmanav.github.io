// Satır içi SVG ikonlar (çizgi stili, currentColor).
const svg = (body, size = 22, sw = 1.9) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icon = {
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 22),
  chevDown: svg('<path d="M6 9l6 6 6-6"/>', 16, 2.4),
  chevRight: svg('<path d="M9 18l6-6-6-6"/>', 16, 2.2),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 26, 2.6),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 20, 2.6),
  panel: svg('<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4-5"/><circle cx="12" cy="15" r="1.2"/>', 24),
  drop: svg('<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.300 6-10.500 6-10.500z"/>', 24),
  wrench: svg('<path d="M14.500 6.500a4 4 0 0 0 4.700 5.300l-8.900 8.900a2.100 2.100 0 0 1-3-3l8.900-8.900a4 4 0 0 0-5.300-4.700l2.700 2.700-2 2-2.700-2.700z"/>', 24),
  calendar: svg('<rect x="3.500" y="5" width="17" height="15.500" rx="3"/><path d="M3.500 10h17M8 3v4M16 3v4"/>', 24),
  chart: svg('<path d="M5 20V11M12 20V4M19 20v-6"/>', 24),
  trash: svg('<path d="M4 7h16M9 7V4.500h6V7M6.500 7l1 13h9l1-13M10 11v6M14 11v6"/>', 20),
  download: svg('<path d="M12 4v11M7.500 10.500L12 15l4.500-4.500M5 20h14"/>', 20),
  upload: svg('<path d="M12 15V4M7.500 8.500L12 4l4.500 4.500M5 20h14"/>', 20),
  car: svg('<path d="M4 15.500V12l1.800-4.600A2 2 0 0 1 7.700 6h8.600a2 2 0 0 1 1.900 1.400L20 12v3.500"/><path d="M3 15.500h18V18a1 1 0 0 1-1 1h-1.500a1 1 0 0 1-1-1v-.5h-11V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><circle cx="7.500" cy="12.500" r=".6"/><circle cx="16.500" cy="12.500" r=".6"/>', 24),
  minus: svg('<path d="M6 12h12"/>', 18, 2.4),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 18, 2.2),
};

export const typeIcon = {
  muayene: icon.check, trafik: icon.calendar, kasko: icon.calendar,
  egzoz: icon.calendar, bakim: icon.wrench, diger: icon.calendar,
};
