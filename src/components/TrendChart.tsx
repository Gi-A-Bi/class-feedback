// 회차별 평균 점수의 변화를 보여 주는 작은 선 그래프.
// 한 줄(친구들이 준 평균)만 그리므로 범례는 없고, 제목이 무엇인지 알려 준다.
// 점을 누르면 그 회차가 선택된다. 모든 값은 옆의 회차 목록에도 숫자로 적혀 있다.
interface Props {
  /** 회차마다의 평균(1~5). 평가가 없던 회차는 null. */
  values: (number | null)[]
  selectedIndex: number
  onSelect: (index: number) => void
  labelOf: (index: number) => string
}

const W = 264
const H = 132
const PAD = { top: 22, right: 16, bottom: 22, left: 24 }
const TICKS = [1, 3, 5]

export default function TrendChart({ values, selectedIndex, onSelect, labelOf }: Props) {
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) =>
    PAD.left + (values.length === 1 ? innerW / 2 : (innerW * i) / (values.length - 1))
  const y = (v: number) => PAD.top + innerH * (1 - (v - 1) / 4)

  const points = values
    .map((v, i) => (v === null ? null : { i, v, cx: x(i), cy: y(v) }))
    .filter((p): p is { i: number; v: number; cx: number; cy: number } => p !== null)
  const path = points.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(' ')

  return (
    <svg
      className="trend"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="group"
      aria-label="발표할 때마다 친구들이 준 평균 점수"
    >
      {/* 눈금선: 가늘고 흐리게 */}
      {TICKS.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--c-border)" strokeWidth="1" />
          <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="trend__tick">
            {t}
          </text>
        </g>
      ))}

      {/* 회차 이름: 처음과 마지막만 적어 겹치지 않게 한다 */}
      <text x={x(0)} y={H - 4} textAnchor="start" className="trend__tick">1회</text>
      {values.length > 1 && (
        <text x={x(values.length - 1)} y={H - 4} textAnchor="end" className="trend__tick">
          {values.length}회
        </text>
      )}

      <path d={path} fill="none" stroke="var(--c-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p) => {
        const on = p.i === selectedIndex
        return (
          <g key={p.i}>
            {/* 바탕색 고리로 선과 겹쳐도 점이 또렷하게 */}
            <circle cx={p.cx} cy={p.cy} r={on ? 8 : 6} fill="var(--c-surface)" />
            <circle cx={p.cx} cy={p.cy} r={on ? 6 : 4} fill="var(--c-primary)" />
            {on && (
              <text x={p.cx} y={p.cy - 12} textAnchor="middle" className="trend__value">
                {p.v.toFixed(1)}
              </text>
            )}
            {/* 누르는 곳은 점보다 훨씬 크게 */}
            <circle
              cx={p.cx}
              cy={p.cy}
              r={22}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={`${labelOf(p.i)}, 평균 ${p.v.toFixed(1)}점`}
              aria-pressed={on}
              className="trend__hit"
              onClick={() => onSelect(p.i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(p.i)
                }
              }}
            >
              <title>{`${labelOf(p.i)} · ${p.v.toFixed(1)}점`}</title>
            </circle>
          </g>
        )
      })}
    </svg>
  )
}
