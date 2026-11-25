// 별 1개~5개를 각각 몇 번 줬는지 보여 주는 가로 막대.
// 한 가지를 세는 것이라 색은 주 색 하나만 쓰고, 횟수는 막대 옆에 글자로 적는다.
import './StarBars.css'

interface Props {
  /** 별 1개, 2개, … 5개를 준 횟수. 길이 5. */
  distribution: number[]
  /** 화면 낭독기에 읽어 줄 제목 */
  label: string
}

export default function StarBars({ distribution, label }: Props) {
  const max = Math.max(1, ...distribution)
  return (
    <table className="starbars" aria-label={label}>
      <tbody>
        {[5, 4, 3, 2, 1].map((star) => {
          const n = distribution[star - 1] ?? 0
          return (
            <tr key={star}>
              <th scope="row">별 {star}개</th>
              <td className="starbars__track">
                {n > 0 && (
                  <span className="starbars__bar" style={{ width: `${(n / max) * 100}%` }} title={`별 ${star}개 · ${n}번`} />
                )}
              </td>
              <td className="starbars__num">{n}번</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
