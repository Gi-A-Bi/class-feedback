// 별점 1~5. 누르는 곳은 52px(기획 문서의 디자인 값).
import './StarRating.css'

interface Props {
  value: number | undefined
  onChange: (value: number) => void
  label: string
  /** 자기 평가 화면에서는 노란 강조 바탕 위에 올라간다. */
  tone?: 'normal' | 'self'
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <path
        d="M12 3.2l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.1 6.6 20l1-6.1L3.2 9.6l6.1-.9z"
        fill={filled ? 'var(--c-star-fill)' : 'none'}
        stroke={filled ? 'var(--c-star-fill-stroke)' : 'var(--c-star-empty-stroke)'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function StarRating({ value, onChange, label, tone = 'normal' }: Props) {
  return (
    <div className={`stars stars--${tone}`}>
      <span className="stars__label">{label}</span>
      <div className="stars__row" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label} ${n}점`}
            className="stars__btn"
            onClick={() => onChange(n)}
          >
            <Star filled={value !== undefined && n <= value} />
          </button>
        ))}
      </div>
    </div>
  )
}
