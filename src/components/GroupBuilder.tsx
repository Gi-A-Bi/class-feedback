// 모둠 편성. 모둠 수를 정해 자동으로 나누고, 손으로 옮기고, 이전 활동의 편성을 불러온다.
// 쓰는 법: 모둠 칸을 눌러 고른 뒤, 위쪽 "모둠이 없는 학생"에서 이름을 누르면 그 모둠에 들어간다.
//          모둠 안의 이름을 누르면 다시 빠진다.
import { useState } from 'react'
import { ChevronDown, ChevronUp, ShuffleIcon } from './Icons'
import {
  defaultGroupName,
  newGroupKey,
  splitIntoGroups,
  type GroupDraft,
} from '../lib/groups'
import { shuffle } from '../lib/results'
import type { ActivityWithId, StudentWithId } from '../lib/types'
import './GroupBuilder.css'

interface Props {
  students: StudentWithId[]
  groups: GroupDraft[]
  onChange: (groups: GroupDraft[]) => void
  /** 이 학급에서 전에 했던 모둠 활동들 */
  previousActivities: ActivityWithId[]
  onLoadPrevious: (activityId: string) => void
  loadingPrevious: boolean
}

export default function GroupBuilder({
  students,
  groups,
  onChange,
  previousActivities,
  onLoadPrevious,
  loadingPrevious,
}: Props) {
  const [count, setCount] = useState(() => Math.max(2, Math.round(students.length / 4)))
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const byId = new Map(students.map((s) => [s.id, s]))
  const assigned = new Set(groups.flatMap((g) => g.studentIds))
  const unassigned = students.filter((s) => !assigned.has(s.id))
  // 고른 모둠이 없거나 사라졌으면 첫 모둠에 넣는다
  const active = groups.find((g) => g.key === activeKey) ?? groups[0] ?? null

  const sortByNumber = (ids: string[]) =>
    [...ids].sort((a, b) => (byId.get(a)?.number ?? 999) - (byId.get(b)?.number ?? 999))

  function autoSplit(random: boolean) {
    const ids = students.map((s) => s.id)
    const next = splitIntoGroups(random ? shuffle(ids) : ids, count).map((g) => ({
      ...g,
      studentIds: sortByNumber(g.studentIds),
    }))
    onChange(next)
    setActiveKey(next[0]?.key ?? null)
  }

  function addGroup() {
    const group = { key: newGroupKey(), name: defaultGroupName(groups.length), studentIds: [] }
    onChange([...groups, group])
    setActiveKey(group.key)
  }

  function addStudent(studentId: string) {
    if (!active) return
    onChange(
      groups.map((g) =>
        g.key === active.key ? { ...g, studentIds: sortByNumber([...g.studentIds, studentId]) } : g,
      ),
    )
  }

  function removeStudent(groupKey: string, studentId: string) {
    onChange(
      groups.map((g) =>
        g.key === groupKey ? { ...g, studentIds: g.studentIds.filter((id) => id !== studentId) } : g,
      ),
    )
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= groups.length) return
    const next = [...groups]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="gb">
      <div className="gb__tools">
        <label htmlFor="gb-count" className="gb__countLabel">모둠 수</label>
        <input
          id="gb-count"
          className="gb__count"
          type="number"
          min={1}
          max={Math.max(1, students.length)}
          value={count}
          onChange={(e) => setCount(Number(e.target.value) || 1)}
        />
        <button type="button" className="btn--quiet btn--small" onClick={() => autoSplit(false)}>
          번호순으로 나누기
        </button>
        <button type="button" className="btn--quiet btn--small gb__iconBtn" onClick={() => autoSplit(true)}>
          <ShuffleIcon size={16} />
          무작위로 나누기
        </button>
        {previousActivities.length > 0 && (
          <select
            className="gb__select"
            value=""
            disabled={loadingPrevious}
            onChange={(e) => e.target.value && onLoadPrevious(e.target.value)}
            aria-label="이전 활동의 모둠 불러오기"
          >
            <option value="">{loadingPrevious ? '불러오는 중…' : '이전 활동의 모둠 불러오기'}</option>
            {previousActivities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="gb__pool">
        <span className="gb__poolLabel">
          모둠이 없는 학생 {unassigned.length}명
          {active && unassigned.length > 0 && (
            <> — 이름을 누르면 <strong>{active.name || '고른 모둠'}</strong>에 들어갑니다</>
          )}
        </span>
        {unassigned.length > 0 && (
          <div className="gb__chips">
            {unassigned.map((s) => (
              <button
                key={s.id}
                type="button"
                className="gb__chip"
                disabled={!active}
                onClick={() => addStudent(s.id)}
              >
                {s.number} {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <ol className="gb__groups">
        {groups.map((g, i) => (
          <li
            key={g.key}
            className={`gb__group${active?.key === g.key ? ' gb__group--on' : ''}`}
            onClick={() => setActiveKey(g.key)}
          >
            <div className="gb__groupHead">
              <span className="gb__pos">{i + 1}</span>
              <input
                type="text"
                className="gb__name"
                value={g.name}
                maxLength={20}
                aria-label={`${i + 1}번째 모둠 이름`}
                onFocus={() => setActiveKey(g.key)}
                onChange={(e) =>
                  onChange(groups.map((x) => (x.key === g.key ? { ...x, name: e.target.value } : x)))
                }
              />
              <span className="gb__size">{g.studentIds.length}명</span>
              <button
                type="button"
                className="gb__move"
                disabled={i === 0}
                onClick={(e) => { e.stopPropagation(); move(i, -1) }}
                aria-label={`${g.name} 발표 순서를 앞으로`}
              >
                <ChevronUp />
              </button>
              <button
                type="button"
                className="gb__move"
                disabled={i === groups.length - 1}
                onClick={(e) => { e.stopPropagation(); move(i, 1) }}
                aria-label={`${g.name} 발표 순서를 뒤로`}
              >
                <ChevronDown />
              </button>
              <button
                type="button"
                className="btn--danger btn--small"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(groups.filter((x) => x.key !== g.key))
                }}
                aria-label={`${g.name} 지우기`}
              >
                지우기
              </button>
            </div>
            <div className="gb__chips">
              {g.studentIds.length === 0 ? (
                <span className="gb__empty">아직 학생이 없어요.</span>
              ) : (
                g.studentIds.map((id) => {
                  const s = byId.get(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      className="gb__chip gb__chip--in"
                      title="누르면 모둠에서 빠집니다"
                      onClick={(e) => { e.stopPropagation(); removeStudent(g.key, id) }}
                    >
                      {s ? `${s.number} ${s.name}` : '(지워진 학생)'}
                    </button>
                  )
                })
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="row">
        <button type="button" className="btn--ghost btn--small" onClick={addGroup}>
          모둠 더하기
        </button>
        {groups.length > 1 && (
          <button
            type="button"
            className="btn--quiet btn--small gb__iconBtn"
            onClick={() => onChange(shuffle(groups))}
          >
            <ShuffleIcon size={16} />
            발표 순서 섞기
          </button>
        )}
      </div>
    </div>
  )
}
