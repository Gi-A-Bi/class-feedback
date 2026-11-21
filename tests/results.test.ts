// 결과 계산 테스트. 학생에게 무엇이 넘어가고 무엇이 넘어가지 않는지를 확인한다.
import { describe, expect, it } from 'vitest'
import { buildRecords, overallAverage, shuffle, summarize } from '../src/lib/results'
import type { Evaluation } from '../src/lib/types'

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
