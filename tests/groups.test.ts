import { describe, expect, it } from 'vitest'
import {
  groupProblem,
  groupsFromPresentations,
  presentationLabel,
  presentationMembers,
  splitIntoGroups,
} from '../src/lib/groups'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i + 1}`)
const sizes = (n: number, count: number) => splitIntoGroups(ids(n), count).map((g) => g.studentIds.length)

describe('모둠 나누기', () => {
  it('고르게 나누고, 남는 학생은 앞 모둠부터 한 명씩 받는다', () => {
    expect(sizes(10, 3)).toEqual([4, 3, 3])
    expect(sizes(24, 6)).toEqual([4, 4, 4, 4, 4, 4])
    expect(sizes(25, 6)).toEqual([5, 4, 4, 4, 4, 4])
    expect(sizes(5, 2)).toEqual([3, 2])
  })

  it('넘겨받은 순서를 지키고 한 명도 빠뜨리거나 겹치지 않는다', () => {
    const groups = splitIntoGroups(ids(7), 3)
    expect(groups.flatMap((g) => g.studentIds)).toEqual(ids(7))
  })

  it('이름은 1모둠, 2모둠… 으로 붙는다', () => {
    expect(splitIntoGroups(ids(6), 3).map((g) => g.name)).toEqual(['1모둠', '2모둠', '3모둠'])
  })

  it('학생보다 모둠이 많으면 학생 수만큼만 만든다', () => {
    expect(sizes(2, 5)).toEqual([1, 1])
  })

  it('이상한 값이 들어와도 버틴다', () => {
    expect(sizes(4, 0)).toEqual([4])
    expect(sizes(4, -3)).toEqual([4])
    expect(sizes(4, 2.9)).toEqual([2, 2])
    expect(splitIntoGroups([], 3)).toEqual([])
  })

  it('모둠마다 열쇠가 다르다', () => {
    const keys = splitIntoGroups(ids(9), 3).map((g) => g.key)
    expect(new Set(keys).size).toBe(3)
  })
})

describe('이전 활동의 모둠 불러오기', () => {
  const previous = [
    { order: 2, studentIds: ['s3', 's4'], groupName: '해바라기' },
    { order: 1, studentIds: ['s1', 's2'], groupName: '민들레' },
  ]

  it('발표 순서대로 모둠을 되살린다', () => {
    const groups = groupsFromPresentations(previous, new Set(['s1', 's2', 's3', 's4']))
    expect(groups.map((g) => g.name)).toEqual(['민들레', '해바라기'])
    expect(groups[0].studentIds).toEqual(['s1', 's2'])
  })

  it('명단에서 빠진 학생은 덜어 낸다', () => {
    const groups = groupsFromPresentations(previous, new Set(['s1', 's3', 's4']))
    expect(groups[0].studentIds).toEqual(['s1'])
  })

  it('모둠원이 모두 빠진 모둠은 버린다', () => {
    const groups = groupsFromPresentations(previous, new Set(['s3', 's4']))
    expect(groups.map((g) => g.name)).toEqual(['해바라기'])
  })
})

describe('편성 검사', () => {
  const g = (name: string, n: number) => ({ key: name + n, name, studentIds: ids(n) })

  it('문제가 없으면 null', () => {
    expect(groupProblem([g('1모둠', 3), g('2모둠', 2)])).toBeNull()
  })

  it('모둠이 없거나, 빈 모둠이 있거나, 이름이 비었거나 겹치면 알려 준다', () => {
    expect(groupProblem([])).toContain('하나 이상')
    expect(groupProblem([g('1모둠', 3), g('2모둠', 0)])).toContain('2모둠')
    expect(groupProblem([g('  ', 3)])).toContain('이름이 비어')
    expect(groupProblem([g('해바라기', 2), g('해바라기', 2)])).toContain('이름이 같은')
  })
})

describe('발표 이름', () => {
  const nameOf = (id: string) => ({ s1: '1번 김하늘', s2: '2번 이바다' })[id] ?? '(지워진 학생)'

  it('개인 발표는 학생 이름, 모둠 발표는 모둠 이름', () => {
    expect(presentationLabel({ studentIds: ['s1'], groupName: '' }, nameOf)).toBe('1번 김하늘')
    expect(presentationLabel({ studentIds: ['s1', 's2'], groupName: '해바라기' }, nameOf)).toBe('해바라기')
  })

  it('모둠원 목록은 모둠 발표일 때만 나온다', () => {
    expect(presentationMembers({ studentIds: ['s1'], groupName: '' }, nameOf)).toBe('')
    expect(presentationMembers({ studentIds: ['s1', 's2'], groupName: '해바라기' }, nameOf)).toBe(
      '1번 김하늘, 2번 이바다',
    )
  })
})
