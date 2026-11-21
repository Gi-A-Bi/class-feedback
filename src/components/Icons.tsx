// 선으로 그린 작은 아이콘들. 기획 문서: 이모지 대신 선으로 그린 SVG 를 쓴다.
interface IconProps {
  size?: number
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

export function ChevronUp({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 12.5l5-5 5 5" />
    </svg>
  )
}

export function ChevronDown({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 7.5l5 5 5-5" />
    </svg>
  )
}

export function ShuffleIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 6h2.5c2 0 3 1 4.5 4s2.5 4 4.5 4H17" />
      <path d="M3 14h2.5c1.2 0 2-.4 2.8-1.3M11.7 7.3C12.5 6.400 13.3 6 14.5 6H17" />
      <path d="M15 4l2 2-2 2M15 12l2 2-2 2" />
    </svg>
  )
}
