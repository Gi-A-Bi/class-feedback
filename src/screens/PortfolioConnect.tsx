import { useEffect, useRef } from 'react'
import { mountPortfolioBridge } from '../lib/portfolioBridge'

export default function PortfolioConnect() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (root.current) return mountPortfolioBridge(root.current)
  }, [])
  return <div ref={root} />
}
