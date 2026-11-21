// 엑셀 파일에 들어갈 표를 만든다. 표를 만드는 부분은 화면도 Firestore 도 모르는 계산이고,
// 맨 아래 downloadWorkbook 만 브라우저에서 파일을 내려받게 한다.
// 형식만 가져온다. 라이브러리 본체는 내려받기 버튼을 누를 때 불러온다.
import type { Cell } from 'write-excel-file/browser'
import { presentationLabel, presentationMembers } from './groups'
import { isSelfEvaluation, overallAverage, summarize } from './results'
import { isoDate } from './time'
import type {
  Activity,
  Evaluation,
  Ledger,
  Presentation,
  Student,
} from './types'

export interface SheetSpec {
  sheet: string
  data: Cell[][]
  columns: { width?: number }[]
  stickyRowsCount: number
}

type StudentLike = Student & { id: string }
type PresentationLike = Presentation & { id: string }

const head = (text: string): Cell => ({ value: text, fontWeight: 'bold', backgroundColor: '#D3E8DA' })
const round2 = (n: number | null | undefined): number | null =>
  typeof n === 'number' ? Math.round(n * 100) / 100 : null

/** 활동 하나의 결과. "요약" 과 "평가 전체" 두 시트. 교사용이라 평가한 학생 이름이 들어간다. */
export function activitySheets(
  activity: Pick<Activity, 'title' | 'kind' | 'criteria'>,
  presentations: PresentationLike[],
  evaluations: Evaluation[],
  students: StudentLike[],
): SheetSpec[] {
  const byId = new Map(students.map((s) => [s.id, s]))
  const nameOf = (id: string) => {
    const s = byId.get(id)
    return s ? `${s.number}번 ${s.name}` : '(지워진 학생)'
  }
  const criteria = activity.criteria

  const summary: Cell[][] = [
    [
      head('순서'),
      head(activity.kind === 'group' ? '모둠' : '발표자'),
      ...(activity.kind === 'group' ? [head('모둠원')] : []),
      head('평가한 친구 수'),
      ...criteria.map((c) => head(`${c.label} 평균`)),
      head('전체 평균'),
    ],
  ]
  const detail: Cell[][] = [
    [
      head('순서'),
      head(activity.kind === 'group' ? '모둠' : '발표자'),
      head('평가한 학생 번호'),
      head('평가한 학생'),
      head('종류'),
      ...criteria.map((c) => head(c.label)),
      head('칭찬 한 가지 / 잘한 점'),
      head('제안 한 가지 / 다음에 고칠 점'),
      head('숨김'),
    ],
  ]

  presentations.forEach((p, i) => {
    const mine = evaluations.filter((e) => e.presentationId === p.id)
    const s = summarize(criteria, p, mine)
    summary.push([
      i + 1,
      presentationLabel(p, nameOf),
      ...(activity.kind === 'group' ? [presentationMembers(p, nameOf)] : []),
      s.peerCount,
      ...criteria.map((c) => round2(s.peerAverages[c.id])),
      round2(overallAverage(s.peerAverages)),
    ])

    const sorted = [...mine].sort((a, b) => {
      const selfA = isSelfEvaluation(a, p) ? 0 : 1
      const selfB = isSelfEvaluation(b, p) ? 0 : 1
      if (selfA !== selfB) return selfA - selfB
      return (byId.get(a.studentId)?.number ?? 999) - (byId.get(b.studentId)?.number ?? 999)
    })
    for (const e of sorted) {
      const who = byId.get(e.studentId)
      detail.push([
        i + 1,
        presentationLabel(p, nameOf),
        who?.number ?? null,
        who?.name ?? '(지워진 학생)',
        isSelfEvaluation(e, p) ? '자기 평가' : '동료 평가',
        ...criteria.map((c) => e.scores[c.id] ?? null),
        e.comment1,
        e.comment2,
        e.hidden ? '숨김' : '',
      ])
    }
  })

  return [
    {
      sheet: '요약',
      data: summary,
      columns: [
        { width: 6 },
        { width: 18 },
        ...(activity.kind === 'group' ? [{ width: 36 }] : []),
        { width: 14 },
        ...criteria.map(() => ({ width: 12 })),
        { width: 12 },
      ],
      stickyRowsCount: 1,
    },
    {
      sheet: '평가 전체',
      data: detail,
      columns: [
        { width: 6 },
        { width: 18 },
        { width: 16 },
        { width: 12 },
        { width: 10 },
        ...criteria.map(() => ({ width: 8 })),
        { width: 44 },
        { width: 44 },
        { width: 8 },
      ],
      stickyRowsCount: 1,
    },
  ]
}

/** 학급의 누적 기록. "한눈에" 와 "기준별" 두 시트. */
export function cumulativeSheets(ledgers: Ledger[], students: StudentLike[]): SheetSpec[] {
  const overview: Cell[][] = [
    [
      head('번호'),
      head('이름'),
      ...ledgers.map((l) => head(`${l.title} (${isoDate(l.activityCreatedAt)})`)),
      head('평균'),
    ],
  ]
  const byCriterion: Cell[][] = [
    [
      head('번호'),
      head('이름'),
      head('활동'),
      head('날짜'),
      head('유형'),
      head('모둠'),
      head('평가한 친구 수'),
      head('기준'),
      head('친구들 평균'),
      head('자기 평가'),
    ],
  ]

  for (const s of students) {
    const perActivity = ledgers.map((l) => {
      const entry = l.entries[s.id]
      return entry ? overallAverage(entry.peerAverages) : null
    })
    const values = perActivity.filter((v): v is number => v !== null)
    overview.push([
      s.number,
      s.name,
      ...perActivity.map(round2),
      values.length ? round2(values.reduce((a, b) => a + b, 0) / values.length) : null,
    ])

    for (const l of ledgers) {
      const entry = l.entries[s.id]
      if (!entry) continue
      for (const c of l.criteria) {
        byCriterion.push([
          s.number,
          s.name,
          l.title,
          isoDate(l.activityCreatedAt),
          l.kind === 'group' ? '모둠' : '개인',
          entry.groupName,
          entry.peerCount,
          c.label,
          round2(entry.peerAverages[c.id]),
          entry.selfScores?.[c.id] ?? null,
        ])
      }
    }
  }

  return [
    {
      sheet: '한눈에',
      data: overview,
      columns: [{ width: 6 }, { width: 12 }, ...ledgers.map(() => ({ width: 24 })), { width: 8 }],
      stickyRowsCount: 1,
    },
    {
      sheet: '기준별',
      data: byCriterion,
      columns: [
        { width: 6 }, { width: 12 }, { width: 24 }, { width: 12 }, { width: 8 },
        { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 10 },
      ],
      stickyRowsCount: 1,
    },
  ]
}

/** 파일 이름에 쓸 수 없는 글자를 뺀다. */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || '발표평가'
}

/** 브라우저에서 엑셀 파일로 내려받는다. 라이브러리는 누를 때에만 불러온다. */
export async function downloadWorkbook(sheets: SheetSpec[], fileName: string): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  await writeExcelFile(sheets).toFile(`${safeFileName(fileName)}.xlsx`)
}
