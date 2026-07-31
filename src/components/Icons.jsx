const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  'aria-hidden': true,
}

export const IconSearch = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)

export const IconHeart = ({ filled, ...p }) => (
  <svg {...base} fill={filled ? 'currentColor' : 'none'} {...p}>
    <path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5c0 5-7 9.5-7 9.5Z" />
  </svg>
)

export const IconGrid = (p) => (
  <svg {...base} {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
)

export const IconList = (p) => (
  <svg {...base} {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
)

export const IconThermo = (p) => (
  <svg {...base} {...p}><path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0Z" /></svg>
)

export const IconWave = (p) => (
  <svg {...base} {...p}><path d="M2 8c2.5-2 4.5 2 7 0s4.5-2 7 0 4.5 2 6 0M2 14c2.5-2 4.5 2 7 0s4.5-2 7 0 4.5 2 6 0M2 20c2.5-2 4.5 2 7 0s4.5-2 7 0 4.5 2 6 0" /></svg>
)

export const IconRain = (p) => (
  <svg {...base} {...p}><path d="M7 15a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.4 1.6A3.5 3.5 0 0 1 17.5 15M8 18.5l-.5 2M12 18.5l-.5 2M16 18.5l-.5 2" /></svg>
)

export const IconPlane = (p) => (
  <svg {...base} {...p}><path d="M10.5 13.5 3 11l1-2 8 1.5 4-4.5a2 2 0 0 1 3 2.6L15 12.5 17 21l-2 1-3.5-6.5L8 19l-3 .5.5-3Z" /></svg>
)

export const IconPin = (p) => (
  <svg {...base} {...p}><path d="M12 21s6.5-5.5 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.5 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.3" /></svg>
)

export const IconScale = (p) => (
  <svg {...base} {...p}><path d="M12 4v16M4 8h16M7 8l-3 6h6ZM17 8l-3 6h6Z" /></svg>
)

export const IconSparkle = (p) => (
  <svg {...base} {...p}><path d="M12 3.5 13.6 8.4 18.5 10 13.6 11.6 12 16.5 10.4 11.6 5.5 10 10.4 8.4 12 3.5Z" /><path d="M18 15.5 18.7 17.3 20.5 18 18.7 18.7 18 20.5 17.3 18.7 15.5 18 17.3 17.3 18 15.5Z" /></svg>
)

export const IconClock = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></svg>
)

export const IconUser = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
)

/* Ingranaggio vero: la versione precedente era un cerchio con raggi, cioè
   il disegno universale di un sole — e in unapp si legge "tema chiaro/scuro". */
export const IconSettings = (p) => (
  <svg {...base} {...p}>
    <path d="M10.4 3.6a1 1 0 0 1 1-.85h1.2a1 1 0 0 1 1 .85l.16 1.2c.5.16.97.4 1.4.7l1.1-.45a1 1 0 0 1 1.2.4l.6 1.05a1 1 0 0 1-.2 1.26l-.94.78c.05.5.05 1 0 1.5l.94.78a1 1 0 0 1 .2 1.26l-.6 1.05a1 1 0 0 1-1.2.4l-1.1-.45c-.43.3-.9.54-1.4.7l-.16 1.2a1 1 0 0 1-1 .85h-1.2a1 1 0 0 1-1-.85l-.16-1.2a6.4 6.4 0 0 1-1.4-.7l-1.1.45a1 1 0 0 1-1.2-.4l-.6-1.05a1 1 0 0 1 .2-1.26l.94-.78a6.6 6.6 0 0 1 0-1.5l-.94-.78a1 1 0 0 1-.2-1.26l.6-1.05a1 1 0 0 1 1.2-.4l1.1.45c.43-.3.9-.54 1.4-.7Z" />
    <circle cx="12" cy="11.6" r="2.5" />
  </svg>
)

export const IconLogout = (p) => (
  <svg {...base} {...p}><path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2M10 12h10m0 0-3-3m3 3-3 3" /></svg>
)

export const IconPlus = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
)

export const IconTrash = (p) => (
  <svg {...base} {...p}><path d="M4 7h16M9.5 7V5h5v2M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" /></svg>
)

export const IconMountain = (p) => (
  <svg {...base} {...p}><path d="m3 19 6-9 4 5.5 2.5-3.5L21 19H3Z" /><circle cx="17" cy="6.5" r="2" /></svg>
)

export const IconEuro = (p) => (
  <svg {...base} {...p}><path d="M17 6.5a6 6 0 1 0 0 11M4 10h8M4 14h8" /></svg>
)

export const IconMenu = (p) => (
  <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
)

export const IconArrowUp = (p) => (
  <svg {...base} {...p}><path d="M12 20V5M6 11l6-6 6 6" /></svg>
)

export const IconChevron = (p) => (
  <svg {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>
)

export const IconEdit = (p) => (
  <svg {...base} {...p}><path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" /><path d="M13.5 7.5 16.5 10.5" /></svg>
)

export const IconFilter = (p) => (
  <svg {...base} {...p}><path d="M3 5h18M6.5 12h11M10 19h4" /></svg>
)

export const IconDownload = (p) => (
  <svg {...base} {...p}><path d="M12 4v11M8 11.5l4 4 4-4M4 20h16" /></svg>
)

export const IconUpload = (p) => (
  <svg {...base} {...p}><path d="M12 16V5M8 8.5l4-4 4 4M4 20h16" /></svg>
)
