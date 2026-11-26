import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { getAuthClient, getDb } from './firebase'
import { signInTeacher } from './authContext'
import { bridgeTarget, ledgerSummary, classListStatus, PROTOCOL } from './portfolioProtocol'

export function mountPortfolioBridge(root) {
  const target = bridgeTarget(location.hash, import.meta.env.DEV)
  const opener = window.opener
  let ended = false, teacher = null, permitted = false, classId = '', classes = [], classStops = [], authStop, listStop, timer, heartbeat, classRetryTimer
  let classesAcknowledged = false, serverClassesReady = false, classAttempts = 0
  let roster = [], ledgers = [], activities = [], ready = {}, known = [], sent = new Map()
  root.innerHTML = '<main class="page"><section class="content" style="max-width:760px"><div class="card"><h1 class="card__title">포트폴리오 연결</h1><p id="bridge-info" class="card__hint"></p><p id="bridge-account" class="card__hint"></p><p id="bridge-status" role="status"></p><ul id="bridge-class-list" hidden></ul><div class="row"><button id="bridge-login">Google 계정으로 로그인</button><button id="bridge-allow" hidden>연결 허용</button><button id="bridge-stop" class="btn--quiet" hidden>연결 중지</button><button id="bridge-resend" class="btn--quiet" hidden>학급 목록 다시 보내기</button><button id="bridge-return" class="btn--quiet" hidden>포트폴리오 창으로 돌아가기</button></div><p class="card__hint">선택한 학급의 번호·이름과 활동별 기준·동료 평가 평균·자기 평가·평가 인원만 전합니다. 평가자 이름, 코멘트 원문, 입장 코드와 인증 정보는 전하지 않습니다. 이 창을 열어 두면 변경을 확인하고, 닫으면 동기화를 멈춥니다.</p><p><a href="/teacher" target="_blank" rel="noopener noreferrer">피드백 학급 관리 열기</a></p><a href="/privacy.html">개인정보처리방침</a></div></section></main>'
  const el = id => root.querySelector('#' + id)
  const status = text => { el('bridge-status').textContent = text }
  function post(type, data = {}) {
    if (!target || !opener || ended) return
    opener.postMessage({ protocol: PROTOCOL, channel: target.channel, type, ...data }, target.origin)
  }
  function drawClasses() {
    const list = el('bridge-class-list')
    list.replaceChildren(...classes.map(c => { const li = document.createElement('li'); li.textContent = c.name; return li }))
    list.hidden = !permitted || !classes.length
  }
  function announceClasses() {
    if (!permitted || !serverClassesReady || ended) return
    clearTimeout(classRetryTimer)
    post('classes', { teacherId: teacher.uid, classes })
    if (!classId) status(classListStatus(classes.length, classesAcknowledged))
    if (!classesAcknowledged && ++classAttempts < 8) classRetryTimer = setTimeout(announceClasses, 2000)
    else if (!classesAcknowledged && !classId && classes.length) status('학급은 있지만 포트폴리오 창의 응답이 없어요. 원래 포트폴리오를 새로고침한 뒤 연결 창을 다시 열어 주세요.')
  }
  function stopClass() { classStops.forEach(fn => fn()); classStops = []; clearTimeout(timer); classId = ''; ready = {}; sent = new Map() }
  function stop(reason) { stopClass(); listStop?.(); listStop = null; permitted = false; clearTimeout(classRetryTimer); classesAcknowledged = false; serverClassesReady = false; classes = []; drawClasses(); el('bridge-resend').hidden = true; el('bridge-return').hidden = true; post('stopped'); el('bridge-stop').hidden = true; el('bridge-allow').hidden = !teacher; status(reason) }
  function fail() { post('error', { message: '피드백을 읽지 못했어요. 계정 권한이나 무료 사용 한도, 인터넷 연결을 확인해 주세요.' }); stop('연결을 멈췄어요. 포트폴리오에서 연결 창을 다시 열어 주세요.') }
  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (!classId || !ready.roster || !ready.ledgers || !ready.activities) return
      if (roster.length > 200 || ledgers.length > 300) { fail(); return }
      const basic = { teacherId: teacher.uid, classId, roster: roster.map(s => ({ id: s.id, number: s.number, name: s.name })) }
      post('roster', { ...basic, className: classes.find(c => c.id === classId)?.name || '' })
      post('catalog', { ...basic, activities: ledgers.map(l => ({ id: l.id, title: l.title })) })
      const current = new Set(ledgers.map(l => l.id))
      post('missing', { ...basic, ids: known.filter(id => !current.has(id)) })
      for (const l of ledgers) {
        const s = ledgerSummary(l, activities.find(a => a.id === l.id), roster)
        if (!s) continue
        const value = JSON.stringify(s)
        if (value.length > 1400000) { fail(); return }
        if (sent.get(l.id) !== value) { post('summary', { ...basic, summary: s }); sent.set(l.id, value) }
      }
      known = [...new Set([...known, ...current])]
      status('연결 중이에요. 포트폴리오에서 학생과 활동 연결을 확인해 주세요.')
    }, 120)
  }
  function choose(id, previous) {
    if (!permitted || !classes.some(c => c.id === id)) return
    classesAcknowledged = true; clearTimeout(classRetryTimer)
    stopClass(); classId = id; roster = []; ledgers = []; activities = []; known = Array.isArray(previous) ? previous.filter(v => typeof v === 'string').slice(0, 300) : []
    const live = (ref, key, callback) => onSnapshot(ref, { includeMetadataChanges: true }, snap => {
      if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) return
      callback(snap.docs.map(d => ({ ...d.data(), id: d.id }))); ready[key] = true; schedule()
    }, fail)
    classStops.push(live(collection(getDb(), 'classes', id, 'students'), 'roster', rows => { roster = rows }))
    classStops.push(live(collection(getDb(), 'classes', id, 'ledger'), 'ledgers', rows => { ledgers = rows }))
    classStops.push(live(query(collection(getDb(), 'activities'), where('teacherId', '==', teacher.uid)), 'activities', rows => { activities = rows.filter(a => a.classId === id) }))
  }
  function receive(e) {
    const m = e.data
    if (!target || e.origin !== target.origin || e.source !== opener || !m || m.protocol !== PROTOCOL || m.channel !== target.channel) return
    if (m.type === 'classes-received') { classesAcknowledged = true; clearTimeout(classRetryTimer); if (!classId) status(classListStatus(classes.length, true)) }
    if (m.type === 'choose') choose(m.classId, m.knownActivityIds)
    if (m.type === 'stop') stop('포트폴리오에서 연결을 종료했어요.')
  }
  if (!target || !opener) { el('bridge-login').hidden = true; status('포트폴리오 교사 화면의 ‘피드백 연결’에서 열어 주세요.'); return () => { ended = true } }
  el('bridge-info').textContent = target.label + '에 결과를 연결합니다. 연결 대상: ' + target.origin
  el('bridge-allow').onclick = () => {
    if (!teacher || permitted) return
    permitted = true; classesAcknowledged = false; serverClassesReady = false; classAttempts = 0; el('bridge-allow').hidden = true; el('bridge-stop').hidden = false; el('bridge-resend').hidden = false; el('bridge-return').hidden = false; status('서버에서 이 계정의 피드백 학급을 확인하고 있어요.')
    listStop = onSnapshot(query(collection(getDb(), 'classes'), where('teacherId', '==', teacher.uid)), { includeMetadataChanges: true }, snap => {
      if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) return
      classes = snap.docs.map(d => ({ id: d.id, name: d.data().name })); serverClassesReady = true; classesAcknowledged = false; classAttempts = 0; drawClasses(); announceClasses()
      if (classId && !classes.some(c => c.id === classId)) { stop('연결한 학급이 삭제되었어요.'); return }
    }, fail)
  }
  el('bridge-login').onclick = async () => { try { await signInTeacher(true) } catch { status('로그인하지 못했어요. 로그인 창 허용과 계정을 확인해 주세요.') } }
  el('bridge-resend').onclick = () => { classesAcknowledged = false; classAttempts = 0; announceClasses() }
  el('bridge-return').onclick = () => opener.focus()
  el('bridge-stop').onclick = () => stop('연결을 중지했어요. 보관한 결과는 포트폴리오에 남아요.')
  authStop = onAuthStateChanged(getAuthClient(), user => {
    if (permitted) stop('접속 계정이 바뀌어 연결을 중지했어요.')
    teacher = user && !user.isAnonymous ? user : null
    el('bridge-login').hidden = false; el('bridge-login').textContent = teacher ? '다른 교사 계정으로 로그인' : 'Google 계정으로 로그인'; el('bridge-allow').hidden = !teacher
    el('bridge-account').textContent = teacher ? '현재 로그인: ' + (teacher.email || teacher.displayName || '교사 계정') : ''
    status(teacher ? '피드백 교사 계정으로 로그인했어요. 연결 대상을 확인하고 허용해 주세요.' : '피드백을 운영하는 교사 계정으로 로그인해 주세요.')
  })
  window.addEventListener('message', receive)
  heartbeat = setInterval(() => { if (opener.closed) stop('포트폴리오 창이 닫혀 연결을 중지했어요.') }, 10000)
  return () => { post('stopped'); ended = true; stopClass(); listStop?.(); authStop?.(); clearInterval(heartbeat); clearTimeout(classRetryTimer); window.removeEventListener('message', receive) }
}
