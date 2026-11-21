// 엑셀 내려받기 테스트. 표의 내용이 맞는지, 그리고 실제로 열리는 xlsx 파일이 만들어지는지 본다.
import { unzipSync, strFromU8 } from 'fflate'
import writeExcelFile from 'write-excel-file/node'
import { describe, expect, it } from 'vitest'
import { activitySheets, cumulativeSheets, safeFileName } from '../src/lib/export'
import { buildLedgerEntries } from '../src/lib/results'
import type { Evaluation, Ledger } from '../src/lib/types'

const criteria = [
  { id: 'content', label: '내용' },
  { id: 'delivery', label: '전달' },
]
const students = [
  { id: 's1', number: 1, name: '김하늘' },
  { id: 's2', number: 2, name: '이바다' },
  { id: 's3', number: 3, name: '박나무' },
]
const P1 = { id: 'p1', order: 1, studentIds: ['s1'], groupName: '', topic: '' }
const P2 = { id: 'p2', order: 2, studentIds: ['s2'], groupName: '', topic: '' }

function ev(presentationId: string, studentId: string, content: number, delivery: number, extra: Partial<Evaluation> = {}): Evaluation {
  return {
    presentationId, studentId, kind: 'peer', scores: { content, delivery },
    comment1: '', comment2: '', hidden: false, createdAt: 0, updatedAt: 0, ...extra,
  }
}

const evaluations = [
  ev('p1', 's2', 4, 5, { comment1: '목소리가 또렷했어요' }),
  ev('p1', 's3', 2, 4, { comment1: '숨길 말', hidden: true }),
  ev('p1', 's1', 5, 5, { kind: 'self', comment1: '연습을 많이 했어요' }),
  ev('p2', 's1', 3, 3),
]

/** 셀이 꾸밈이 붙은 객체여도 값만 꺼낸다 */
const plain = (rows: unknown[][]) =>
  rows.map((r) => r.map((c) => (c && typeof c === 'object' ? (c as { value: unknown }).value : c)))

describe('활동 하나의 엑셀', () => {
  const activity = { title: '우리 고장 소개하기', kind: 'individual' as const, criteria }
  const [summary, detail] = activitySheets(activity, [P1, P2], evaluations, students)

  it('요약 시트: 발표자마다 평가 수와 기준별 평균', () => {
    expect(summary.sheet).toBe('요약')
    expect(plain(summary.data)).toEqual([
      ['순서', '발표자', '평가한 친구 수', '내용 평균', '전달 평균', '전체 평균'],
      [1, '1번 김하늘', 2, 3, 4.5, 3.75],
      [2, '2번 이바다', 1, 3, 3, 3],
    ])
  })

  it('평가 전체 시트: 평가한 학생 이름과 점수와 코멘트, 숨김 여부', () => {
    const rows = plain(detail.data)
    expect(rows[0]).toEqual([
      '순서', '발표자', '평가한 학생 번호', '평가한 학생', '종류', '내용', '전달',
      '칭찬 한 가지 / 잘한 점', '제안 한 가지 / 다음에 고칠 점', '숨김',
    ])
    // 자기 평가가 먼저, 그다음 번호순
    expect(rows[1]).toEqual([1, '1번 김하늘', 1, '김하늘', '자기 평가', 5, 5, '연습을 많이 했어요', '', ''])
    expect(rows[2]).toEqual([1, '1번 김하늘', 2, '이바다', '동료 평가', 4, 5, '목소리가 또렷했어요', '', ''])
    expect(rows[3]).toEqual([1, '1번 김하늘', 3, '박나무', '동료 평가', 2, 4, '숨길 말', '', '숨김'])
    expect(rows).toHaveLength(5)
  })

  it('열 수와 열 너비 수가 맞는다', () => {
    expect(summary.columns).toHaveLength(summary.data[0].length)
    expect(detail.columns).toHaveLength(detail.data[0].length)
  })

  it('모둠 발표면 모둠 이름과 모둠원 열이 생긴다', () => {
    const group = { id: 'g1', order: 1, studentIds: ['s1', 's2'], groupName: '해바라기', topic: '' }
    const [s] = activitySheets({ ...activity, kind: 'group' }, [group], [ev('g1', 's3', 4, 4)], students)
    expect(plain(s.data)).toEqual([
      ['순서', '모둠', '모둠원', '평가한 친구 수', '내용 평균', '전달 평균', '전체 평균'],
      [1, '해바라기', '1번 김하늘, 2번 이바다', 1, 4, 4, 4],
    ])
    expect(s.columns).toHaveLength(7)
  })
})

describe('누적 기록의 엑셀', () => {
  const ledger = (title: string, day: number, evs: Evaluation[]): Ledger => ({
    activityId: title, title, kind: 'individual', criteria,
    activityCreatedAt: new Date(2026, 10, day).getTime(), updatedAt: 0,
    entries: buildLedgerEntries({ criteria }, [P1, P2], evs),
  })
  const ledgers = [
    ledger('1차 발표', 20, evaluations),
    ledger('2차 발표', 27, [ev('p1', 's2', 5, 5), ev('p2', 's3', 4, 2)]),
  ]
  const [overview, byCriterion] = cumulativeSheets(ledgers, students)

  it('한눈에 시트: 학생마다 활동별 평균과 그 평균', () => {
    expect(plain(overview.data)).toEqual([
      ['번호', '이름', '1차 발표 (2026-11-20)', '2차 발표 (2026-11-27)', '평균'],
      [1, '김하늘', 3.75, 5, 4.38],
      [2, '이바다', 3, 3, 3],
      [3, '박나무', null, null, null], // 발표하지 않은 학생
    ])
  })

  it('기준별 시트: 학생-활동-기준마다 한 줄, 자기 평가 점수 포함', () => {
    const rows = plain(byCriterion.data)
    expect(rows[1]).toEqual([1, '김하늘', '1차 발표', '2026-11-20', '개인', '', 2, '내용', 3, 5])
    expect(rows[2]).toEqual([1, '김하늘', '1차 발표', '2026-11-20', '개인', '', 2, '전달', 4.5, 5])
    // 자기 평가를 안 한 회차는 빈칸
    expect(rows[3]).toEqual([1, '김하늘', '2차 발표', '2026-11-27', '개인', '', 1, '내용', 5, null])
    // 학생 2명 x 활동 2개 x 기준 2개 + 머리글
    expect(rows).toHaveLength(9)
  })

  it('누적 기록에는 코멘트도 평가한 학생도 들어가지 않는다', () => {
    const text = JSON.stringify(ledgers)
    expect(text).not.toContain('목소리가 또렷했어요')
    expect(text).not.toContain('comment')
  })
})

describe('파일로 만들기', () => {
  it('실제 xlsx 파일이 만들어지고, 시트 이름과 한글 내용이 들어 있다', async () => {
    const sheets = activitySheets(
      { title: '우리 고장 소개하기', kind: 'individual', criteria },
      [P1, P2], evaluations, students,
    )
    const buffer = await writeExcelFile(sheets).toBuffer()
    expect(buffer.subarray(0, 2).toString()).toBe('PK') // xlsx 는 zip 이다
    const files = unzipSync(new Uint8Array(buffer))
    const workbook = strFromU8(files['xl/workbook.xml'])
    expect(workbook).toContain('요약')
    expect(workbook).toContain('평가 전체')
    const allText = Object.entries(files)
      .filter(([name]) => name.endsWith('.xml'))
      .map(([, bytes]) => strFromU8(bytes))
      .join('')
    expect(allText).toContain('김하늘')
    expect(allText).toContain('목소리가 또렷했어요')
  })

  it('파일 이름에 쓸 수 없는 글자를 뺀다', () => {
    expect(safeFileName('3학년 2반: 발표/평가?')).toBe('3학년 2반 발표평가')
    expect(safeFileName('  ')).toBe('발표평가')
  })
})
