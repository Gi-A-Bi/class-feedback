// 평균 별점을 보여 주는 눈금. 4.3 이면 별 넷은 가득, 다섯째는 30%만 채운다.
// 색은 기획 문서의 별 색을 그대로 쓴다. 숫자는 별 옆에 글자 색으로 적는다.
import { useId } from 'react'

interface Props {
  /** 1~5 사이 값. null 이면 값이 없다는 뜻. */
  value: number | null
  size?: number
  /** 화면 낭독기에 읽어 줄 설명. 예: "내용, 친구들 평균" */
  label: string
}

const STAR = 'M12 3.2l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.1 6.6 20l1-6.1L3.2 9.6l6.1-.9z'

export default function StarMeter({ value, size = 22, label }: Props) {
  const id = useId()
  const shown = value === null ? 0 : Math.max(0, Math.min(5, value))
  const text = value === null ? '없음' : `${shown.toFixed(1)}점`

  return (
    <span className="starmeter" role="img" aria-label={`${label} ${text}`}>
      <svg width={size * 5 + 8} height={size} viewBox={`0 0 ${24 * 5 + 8} 24`} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => {
          const part = Math.max(0, Math.min(1, shown - i))
          const x = i * 26
          return (
            <g key={i} transform={`translate(${x} 0)`}>
              <clipPath id={`${id}-${i}`}>
                <rect x="0" y="0" width={24 * part} height="24" />
              </clipPath>
              <path d={STAR} fill="none" stroke="var(--c-star-empty-stroke)" strokeWidth="1.4" strokeLinejoin="round" />
              {part > 0 && (
                <path
                  d={STAR}
                  clipPath={`url(#${id}-${i})`}
                  fill="var(--c-star-fill)"
                  stroke="var(--c-star-fill-stroke)"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              )}
            </g>
          )
        })}
      </svg>
      <span className="starmeter__num">{value === null ? '-' : shown.toFixed(1)}</span>
    </span>
  )
}
