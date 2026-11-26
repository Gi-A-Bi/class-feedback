import { describe, expect, it } from 'vitest'
import { bridgeTarget, ledgerSummary } from '../src/lib/portfolioProtocol'

describe('portfolio message protocol', () => {
  const channel = 'a'.repeat(64)
  const hash = (origin: string) => '#'+new URLSearchParams({ channel, origin }).toString()
  it('accepts a Google Apps Script iframe origin and session nonce', () => {
    expect(bridgeTarget(hash('https://n-fixture-script.googleusercontent.com'))?.channel).toBe(channel)
  })
  it('rejects wildcard, http, userinfo, paths, hostile suffixes and missing nonce', () => {
    for(const origin of ['*','http://script.google.com','https://u@script.google.com','https://script.google.com/path','https://script.google.com.evil.test','https://evil.test'])expect(bridgeTarget(hash(origin))).toBeNull()
    expect(bridgeTarget('#origin=https://script.google.com')).toBeNull()
  })
  it('allows localhost only when explicitly running development', () => {
    expect(bridgeTarget(hash('http://localhost:5173'))).toBeNull()
    expect(bridgeTarget(hash('http://localhost:5173'),true)).not.toBeNull()
  })
  it('copies only summary fields, no comments, auth data or evaluator identities', () => {
    const ledger={id:'round',title:'발표',kind:'group',criteria:[{id:'c',label:'내용'}],activityCreatedAt:1000,updatedAt:2000,entries:{student:{groupName:'1모둠',peerCount:2,peerAverages:{c:4.5},selfScores:{c:4},comment:'secret',token:'secret'},other:{groupName:'',peerCount:1,peerAverages:{c:3},selfScores:null}}}
    const result=ledgerSummary(ledger,{resultsPublished:true},[{id:'student',name:'학생',claimedBy:'private'}])
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].peerAverages).toEqual({c:4.5})
    expect(JSON.stringify(result)).not.toMatch(/secret|claimedBy|private/)
    expect(result.sourcePublished).toBe(true)
  })
  it('waits for a server timestamp rather than inventing history', () => {
    expect(ledgerSummary({activityCreatedAt:null,updatedAt:null},null,[])).toBeNull()
  })
  it('marks orphaned and unpublished results as unavailable to students', () => {
    const ledger={id:'round',title:'발표',kind:'individual',criteria:[],activityCreatedAt:1000,updatedAt:2000,entries:{}}
    expect(ledgerSummary(ledger,null,[]).retired).toBe(true)
    expect(ledgerSummary(ledger,{resultsPublished:false},[]).sourcePublished).toBe(false)
  })
})
