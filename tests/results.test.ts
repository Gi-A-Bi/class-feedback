// 결과 계산 테스트. 학생에게 무엇이 넘어가고 무엇이 넘어가지 않는지를 확인한다.
import { describe, expect, it } from 'vitest'
import { buildDashboard } from '../src/lib/dashboard'
import {
  buildGiven,
  buildLedgerEntries,
  buildRecords,
  overallAverage,
  shuffle,
  summarize,
} from '../src/lib/results'
import { TEACHER_EVALUATOR_ID, type Evaluation } from '../src/lib/types'

const criteria = [
  { id: 'content', label: '내용' },
  { id: 'delivery', label: '전달' },
]
const activity = { title: '우리 고장 소개하기', kind: 'individual' as const, criteria }
const P1 = { id: 'p1', order: 1, studentIds: ['s1'], groupName: '', topic: '' }
const P2 = { id: 'p2', order: 2, studentIds: ['s2'], groupName: '', topic: '' }

function ev(
  presentationId: string,
  studentId: string,
  content: number,
  delivery: number,
  extra: Partial<Evaluation> = {},
): Evaluation {
  return {
    presentationId,
    studentId,
    kind: 'peer',
    scores: { content, delivery },
    comment1: '',
    comment2: '',
    hidden: false,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  }
}

const noShuffle = () => 0.999999

describe('공개 결과 만들기', () => {
  it('친구들 점수의 평균을 기준별로 낸다', () => {
    const records = buildRecords(activity, [P1], [
      ev('p1', 's2', 4, 5),
      ev('p1', 's3', 2, 4),
    ])
    const r = records.get('s1')!
    expect(r.peerCount).toBe(2)
    expect(r.peerAverages).toEqual({ content: 3, delivery: 4.5 })
  })

  it('자기 평가는 평균에 넣지 않고 따로 담는다', () => {
    const records = buildRecords(activity, [P1], [
      ev('p1', 's2', 4, 4),
      ev('p1', 's1', 5, 5, { kind: 'self', comment1: '연습을 많이 했어요', comment2: '천천히 말하기' }),
    ])
    const r = records.get('s1')!
    expect(r.peerCount).toBe(1)
    expect(r.peerAverages).toEqual({ content: 4, delivery: 4 })
    expect(r.self).toEqual({
      scores: { content: 5, delivery: 5 },
      comment1: '연습을 많이 했어요',
      comment2: '천천히 말하기',
    })
  })

  it('발표자가 동료 평가인 척 자기 발표에 점수를 넣어도 평균에 섞이지 않는다', () => {
    const records = buildRecords(activity, [P1], [
      ev('p1', 's2', 2, 2),
      ev('p1', 's1', 5, 5, { kind: 'peer' }), // 발표자 본인이 kind 를 속였다
    ])
    const r = records.get('s1')!
    expect(r.peerCount).toBe(1)
    expect(r.peerAverages).toEqual({ content: 2, delivery: 2 })
  })

  it('숨긴 평가는 코멘트를 빼되 점수는 평균에 남긴다', () => {
    const records = buildRecords(
      activity,
      [P1],
      [
        ev('p1', 's2', 4, 4, { comment1: '목소리가 좋았어요', comment2: '그림을 크게' }),
        ev('p1', 's3', 2, 2, { comment1: '나쁜 말', comment2: '더 나쁜 말', hidden: true }),
      ],
      noShuffle,
    )
    const r = records.get('s1')!
    expect(r.peerAverages).toEqual({ content: 3, delivery: 3 })
    expect(r.praise).toEqual(['목소리가 좋았어요'])
    expect(r.suggestions).toEqual(['그림을 크게'])
  })

  it('빈 코멘트는 싣지 않는다', () => {
    const records = buildRecords(activity, [P1], [
      ev('p1', 's2', 4, 4, { comment1: '   ', comment2: '' }),
      ev('p1', 's3', 4, 4, { comment1: '좋았어요', comment2: '' }),
    ])
    const r = records.get('s1')!
    expect(r.praise).toEqual(['좋았어요'])
    expect(r.suggestions).toEqual([])
  })

  it('결과에는 누가 평가했는지가 들어가지 않는다', () => {
    const records = buildRecords(activity, [P1], [
      ev('p1', 's2', 4, 4, { comment1: '좋았어요' }),
      ev('p1', 's3', 3, 3, { comment1: '재미있었어요' }),
    ])
    const text = JSON.stringify(records.get('s1'))
    expect(text).not.toContain('s2')
    expect(text).not.toContain('s3')
    expect(text).not.toContain('studentId')
  })

  it('다른 발표의 평가는 섞이지 않는다', () => {
    const records = buildRecords(activity, [P1, P2], [
      ev('p1', 's2', 5, 5, { comment1: '1번에게' }),
      ev('p2', 's1', 1, 1, { comment1: '2번에게' }),
    ])
    expect(records.get('s1')!.peerAverages).toEqual({ content: 5, delivery: 5 })
    expect(records.get('s1')!.praise).toEqual(['1번에게'])
    expect(records.get('s2')!.peerAverages).toEqual({ content: 1, delivery: 1 })
    expect(records.get('s2')!.praise).toEqual(['2번에게'])
  })

  it('평가를 하나도 못 받은 발표자도 결과 문서는 생긴다', () => {
    const records = buildRecords(activity, [P1], [])
    const r = records.get('s1')!
    expect(r.peerCount).toBe(0)
    expect(r.peerAverages).toEqual({})
    expect(r.self).toBeNull()
  })

  it('모둠 발표는 모둠원 모두에게 같은 결과가 가고, 자기 평가는 각자 것이 간다', () => {
    const group = { id: 'g1', order: 1, studentIds: ['s1', 's2'], groupName: '해바라기', topic: '' }
    const records = buildRecords({ ...activity, kind: 'group' }, [group], [
      ev('g1', 's3', 4, 4, { comment1: '잘했어요' }),
      ev('g1', 's1', 5, 5, { kind: 'self', comment1: '1번의 돌아보기' }),
      ev('g1', 's2', 3, 3, { kind: 'self', comment1: '2번의 돌아보기' }),
    ])
    expect(records.get('s1')!.peerAverages).toEqual({ content: 4, delivery: 4 })
    expect(records.get('s2')!.peerAverages).toEqual({ content: 4, delivery: 4 })
    expect(records.get('s1')!.groupName).toBe('해바라기')
    expect(records.get('s1')!.self!.comment1).toBe('1번의 돌아보기')
    expect(records.get('s2')!.self!.comment1).toBe('2번의 돌아보기')
  })
})

describe('보조 계산', () => {
  it('summarize 는 자기 평가를 빼고 센다', () => {
    const s = summarize(criteria, P1, [ev('p1', 's2', 4, 2), ev('p1', 's1', 5, 5)])
    expect(s).toEqual({ peerCount: 1, peerAverages: { content: 4, delivery: 2 } })
  })

  it('overallAverage 는 기준별 평균의 평균이다', () => {
    expect(overallAverage({ a: 4, b: 3 })).toBe(3.5)
    expect(overallAverage({})).toBeNull()
  })

  it('shuffle 은 원래 배열을 건드리지 않고 같은 것들을 돌려준다', () => {
    const src = [1, 2, 3, 4, 5]
    const out = shuffle(src)
    expect(src).toEqual([1, 2, 3, 4, 5])
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('선생님 평가', () => {
  const teacher = ev('p1', TEACHER_EVALUATOR_ID, 1, 1, {
    kind: 'teacher',
    comment1: '준비를 많이 했구나',
    comment2: '조금 더 천천히 말해 보자',
  })

  it('친구들 평균에 섞이지 않고 따로 담긴다', () => {
    const r = buildRecords(activity, [P1], [ev('p1', 's2', 4, 5), ev('p1', 's3', 2, 3), teacher], noShuffle).get('s1')!
    expect(r.peerCount).toBe(2)
    expect(r.peerAverages).toEqual({ content: 3, delivery: 4 })
    expect(r.teacher).toEqual({
      scores: { content: 1, delivery: 1 },
      comment1: '준비를 많이 했구나',
      comment2: '조금 더 천천히 말해 보자',
    })
    // 선생님 코멘트가 친구 코멘트 사이에 익명으로 끼지 않는다
    expect(r.praise).toEqual([])
  })

  it('선생님 평가가 없으면 null 이다', () => {
    expect(buildRecords(activity, [P1], [ev('p1', 's2', 4, 5)]).get('s1')!.teacher).toBeNull()
  })

  it('선생님에게는 결과 문서를 만들지 않는다', () => {
    const records = buildRecords(activity, [P1], [teacher])
    expect([...records.keys()]).toEqual(['s1'])
  })

  it('교사용 요약에도 따로 적힌다', () => {
    const entries = buildLedgerEntries(activity, [P1], [ev('p1', 's2', 4, 5), teacher])
    expect(entries.s1.teacherScores).toEqual({ content: 1, delivery: 1 })
    expect(entries.s1.peerCount).toBe(1)
    expect(entries.s1.presentationId).toBe('p1')
  })
})

describe('내가 준 별', () => {
  const evaluations = [
    ev('p1', 's2', 4, 5), // s2 가 s1 을 평가
    ev('p2', 's1', 2, 3), // s1 이 s2 를 평가
    ev('p1', 's3', 5, 5), // s3 은 발표하지 않고 평가만 했다
    ev('p2', 's3', 3, 5),
    ev('p1', 's1', 5, 5, { kind: 'self' }), // 자기 평가는 세지 않는다
    ev('p1', TEACHER_EVALUATOR_ID, 1, 1, { kind: 'teacher' }),
    ev('gone', 's2', 1, 1), // 지워진 발표에 남은 평가
  ]

  it('학생마다 평가한 수, 기준별 평균, 별 개수를 센다', () => {
    const given = buildGiven(activity, [P1, P2], evaluations)
    expect(given.s1).toEqual({ count: 1, averages: { content: 2, delivery: 3 }, distribution: [0, 1, 1, 0, 0] })
    expect(given.s3).toEqual({ count: 2, averages: { content: 4, delivery: 5 }, distribution: [0, 0, 1, 0, 3] })
    expect(given.s2.count).toBe(1)
    expect(given[TEACHER_EVALUATOR_ID]).toBeUndefined()
  })

  it('공개 결과에 내가 준 별이 실린다', () => {
    const records = buildRecords(activity, [P1, P2], evaluations)
    expect(records.get('s1')!.given!.count).toBe(1)
    expect(records.get('s1')!.presented).toBe(true)
  })

  it('발표는 안 하고 평가만 한 학생도 준 별만 담긴 결과를 받는다', () => {
    const r = buildRecords(activity, [P1, P2], evaluations).get('s3')!
    expect(r.presented).toBe(false)
    expect(r.given!.count).toBe(2)
    expect(r.peerCount).toBe(0)
    expect(r.praise).toEqual([])
    expect(JSON.stringify(r)).not.toContain('s1')
  })
})

describe('모아 보기', () => {
  const base = { criteria, peerCount: 0, peerAverages: {}, selfScores: null, teacherScores: null, given: null }

  it('여러 활동의 받은 별과 준 별을 합친다', () => {
    const d = buildDashboard([
      {
        ...base,
        presented: true,
        peerCount: 3,
        peerAverages: { content: 4, delivery: 2 },
        selfScores: { content: 5, delivery: 5 },
        teacherScores: { content: 3, delivery: 3 },
        given: { count: 2, averages: { content: 4, delivery: 5 }, distribution: [0, 0, 1, 0, 3] },
      },
      {
        ...base,
        presented: true,
        peerCount: 2,
        peerAverages: { content: 5, delivery: 5 },
        given: { count: 1, averages: { content: 1, delivery: 1 }, distribution: [2, 0, 0, 0, 0] },
      },
      // 발표하지 않은 활동: 준 별만 있다
      { ...base, presented: false, given: { count: 1, averages: { content: 5, delivery: 5 }, distribution: [0, 0, 0, 0, 2] } },
    ])
    expect(d.presentedCount).toBe(2)
    expect(d.receivedCount).toBe(5)
    expect(d.peerAverage).toBe(4) // (3 + 5) / 2
    expect(d.selfAverage).toBe(5)
    expect(d.teacherAverage).toBe(3)
    expect(d.givenCount).toBe(4)
    expect(d.givenDistribution).toEqual([2, 0, 1, 0, 5])
    expect(d.givenAverage).toBe(3.75) // (2*1 + 3 + 5*5) / 8
    expect(d.criteria[0]).toEqual({ id: 'content', label: '내용', peer: 4.5, self: 5, teacher: 3, given: 10 / 3 })
  })

  it('아무 기록이 없으면 평균은 모두 비어 있다', () => {
    const d = buildDashboard([])
    expect(d.peerAverage).toBeNull()
    expect(d.givenAverage).toBeNull()
    expect(d.criteria).toEqual([])
  })

  it('활동마다 기준이 달라도 같은 id 끼리 모은다', () => {
    const d = buildDashboard([
      { ...base, presented: true, peerCount: 1, peerAverages: { content: 4, delivery: 4 } },
      {
        ...base,
        criteria: [{ id: 'content', label: '내용' }, { id: 'voice', label: '목소리' }],
        presented: true,
        peerCount: 1,
        peerAverages: { content: 2, voice: 5 },
      },
    ])
    expect(d.criteria.map((c) => [c.label, c.peer])).toEqual([['내용', 3], ['전달', 4], ['목소리', 5]])
  })
})
