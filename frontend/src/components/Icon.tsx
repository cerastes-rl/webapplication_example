export function Icon({
  name,
  size = 20
}: {
  name:
    | 'upload'
    | 'history'
    | 'audio'
    | 'arrow'
    | 'logout'
    | 'check'
    | 'sun'
    | 'moon'
  size?: number
}) {
  const paths = {
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5" />
        <path d="M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
      </>
    ),
    history: (
      <>
        <path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    audio: (
      <>
        <path d="M8 3h7l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2Z" />
        <path d="M14 3v5h5M9 13v3m3-5v7m3-5v3" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    logout: (
      <>
        <path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    moon: <path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    )
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
