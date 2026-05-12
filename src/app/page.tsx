'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { formatUnits, isAddress, parseUnits } from 'viem'
import { contractAddress, contractABI } from './contract'

type Hex = `0x${string}`

export default function Page() {
  const { address, isConnected, status } = useAccount()
  const chainId = useChainId()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  // ──── 토큰 기본 정보 ─────────────────────────────────────────
  const { data: tokenInfo } = useReadContracts({
    contracts: [
      { address: contractAddress, abi: contractABI, functionName: 'name' },
      { address: contractAddress, abi: contractABI, functionName: 'symbol' },
      { address: contractAddress, abi: contractABI, functionName: 'decimals' },
      { address: contractAddress, abi: contractABI, functionName: 'totalSupply' },
      { address: contractAddress, abi: contractABI, functionName: 'owner' },
    ],
    query: { refetchInterval: 15000 },
  })
  const name = tokenInfo?.[0]?.result as string | undefined
  const symbol = tokenInfo?.[1]?.result as string | undefined
  const decimals = (tokenInfo?.[2]?.result as number | undefined) ?? 18
  const totalSupply = tokenInfo?.[3]?.result as bigint | undefined
  const owner = tokenInfo?.[4]?.result as Hex | undefined

  // ──── 트랜잭션 상태 ───────────────────────────────────────────
  const { data: hash, isPending, writeContract, reset } = useWriteContract()
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({ hash })

  // ──── 잔액 조회 ───────────────────────────────────────────────
  const [queryAddr, setQueryAddr] = useState('')
  const target = (queryAddr || address) as Hex | undefined
  const { data: balance } = useReadContract({
    address: contractAddress,
    abi: contractABI,
    functionName: 'balanceOf',
    args: target ? [target] : undefined,
    query: { enabled: !!target, refetchInterval: 15000 },
  })

  // ──── allowance 조회 ──────────────────────────────────────────
  const [allowOwner, setAllowOwner] = useState('')
  const [allowSpender, setAllowSpender] = useState('')
  const { data: allowance } = useReadContract({
    address: contractAddress,
    abi: contractABI,
    functionName: 'allowance',
    args:
      isAddress(allowOwner) && isAddress(allowSpender)
        ? [allowOwner as Hex, allowSpender as Hex]
        : undefined,
    query: { enabled: isAddress(allowOwner) && isAddress(allowSpender) },
  })

  // ──── transfer ───────────────────────────────────────────────
  const [tTo, setTTo] = useState('')
  const [tAmt, setTAmt] = useState('')
  const doTransfer = () => {
    if (!isAddress(tTo) || !tAmt) return
    writeContract({
      address: contractAddress,
      abi: contractABI,
      functionName: 'transfer',
      args: [tTo as Hex, parseUnits(tAmt, decimals)],
    })
  }

  // ──── approve ────────────────────────────────────────────────
  const [aSpender, setASpender] = useState('')
  const [aAmt, setAAmt] = useState('')
  const doApprove = () => {
    if (!isAddress(aSpender) || !aAmt) return
    writeContract({
      address: contractAddress,
      abi: contractABI,
      functionName: 'approve',
      args: [aSpender as Hex, parseUnits(aAmt, decimals)],
    })
  }

  // ──── transferFrom ───────────────────────────────────────────
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [fAmt, setFAmt] = useState('')
  const doTransferFrom = () => {
    if (!isAddress(fFrom) || !isAddress(fTo) || !fAmt) return
    writeContract({
      address: contractAddress,
      abi: contractABI,
      functionName: 'transferFrom',
      args: [fFrom as Hex, fTo as Hex, parseUnits(fAmt, decimals)],
    })
  }

  // ──── mint (owner only) ─────────────────────────────────────
  const [mTo, setMTo] = useState('')
  const [mAmt, setMAmt] = useState('')
  const doMint = () => {
    if (!isAddress(mTo) || !mAmt) return
    writeContract({
      address: contractAddress,
      abi: contractABI,
      functionName: 'mint',
      args: [mTo as Hex, parseUnits(mAmt, decimals)],
    })
  }

  const isOwner = useMemo(
    () => owner && address && owner.toLowerCase() === address.toLowerCase(),
    [owner, address],
  )

  useEffect(() => {
    if (isMined) {
      // 트랜잭션 완료 후 잠시 후 hash 초기화
      const t = setTimeout(reset, 3000)
      return () => clearTimeout(t)
    }
  }, [isMined, reset])

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Token DApp</h1>
          <p className="text-sm text-zinc-500">Sepolia ERC-20 테스트 페이지</p>
        </div>
        <a
          className="text-sm underline text-zinc-500"
          href={`https://sepolia.etherscan.io/address/${contractAddress}`}
          target="_blank"
          rel="noreferrer"
        >
          Sepolia Etherscan
        </a>
      </header>

      <p className="text-xs text-zinc-500">
        컨트랙트:&nbsp;<code className="font-mono">{contractAddress}</code>
      </p>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="지갑 / 네트워크">
          <Row label="상태">{isConnected ? short(address!) : '연결 안 됨'}</Row>
          <Row label="체인">
            #{chainId} {chainId === sepolia.id ? '(Sepolia)' : '(다른 네트워크)'}
          </Row>
          {isConnected ? (
            <button
              className="mt-2 rounded bg-zinc-900 text-white px-3 py-1 text-sm"
              onClick={() => disconnect()}
            >
              연결 해제
            </button>
          ) : (
            <button
              className="mt-2 rounded bg-zinc-900 text-white px-3 py-1 text-sm disabled:opacity-50"
              disabled={status === 'connecting' || status === 'reconnecting'}
              onClick={() => connect({ connector: connectors[0] })}
            >
              MetaMask 연결
            </button>
          )}
        </Card>

        <Card title="토큰 정보">
          <Row label="이름">{name ?? '—'}</Row>
          <Row label="심볼">{symbol ?? '—'}</Row>
          <Row label="decimals">{decimals}</Row>
          <Row label="totalSupply">
            {totalSupply ? formatUnits(totalSupply, decimals) : '—'}
          </Row>
          <Row label="owner">{owner ? short(owner) : '—'}</Row>
        </Card>

        <Card title="잔액 조회">
          <Input
            placeholder="0x... (비우면 내 지갑)"
            value={queryAddr}
            onChange={setQueryAddr}
          />
          <Row label="address">{target ? short(target) : '—'}</Row>
          <Row label="balance">
            {balance !== undefined ? formatUnits(balance as bigint, decimals) : '0'}
          </Row>
        </Card>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Transfer (직접 송금)">
          <Input placeholder="to 0x..." value={tTo} onChange={setTTo} />
          <Input placeholder="예) 1.5" value={tAmt} onChange={setTAmt} />
          <Action
            disabled={!isConnected || !isAddress(tTo) || !tAmt || isPending}
            onClick={doTransfer}
            label="전송"
            note={!isConnected ? '지갑 연결 후 실행하세요.' : ''}
          />
        </Card>

        <Card title="TransferFrom (대리 송금)">
          <Input placeholder="from (approve 받은 owner 주소)" value={fFrom} onChange={setFFrom} />
          <Input placeholder="to 받는 주소" value={fTo} onChange={setFTo} />
          <Input placeholder="예) 2" value={fAmt} onChange={setFAmt} />
          <Action
            disabled={!isConnected || !isAddress(fFrom) || !isAddress(fTo) || !fAmt || isPending}
            onClick={doTransferFrom}
            label="transferFrom 실행"
            note={isConnected ? '현재 연결된 지갑(=spender)로 실행됩니다.' : '지갑 연결 후 실행하세요.'}
          />
        </Card>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Approve / Allowance">
          <Input placeholder="spender 0x..." value={aSpender} onChange={setASpender} />
          <Input placeholder="예) 10" value={aAmt} onChange={setAAmt} />
          <Action
            disabled={!isConnected || !isAddress(aSpender) || !aAmt || isPending}
            onClick={doApprove}
            label="approve 실행"
          />
          <div className="border-t pt-3 mt-3 space-y-2">
            <Input placeholder="owner 0x..." value={allowOwner} onChange={setAllowOwner} />
            <Input placeholder="spender 0x..." value={allowSpender} onChange={setAllowSpender} />
            <Row label="allowance">
              {allowance !== undefined ? formatUnits(allowance as bigint, decimals) : '—'}
            </Row>
          </div>
        </Card>

        <Card title="Mint (owner-only)">
          <Input placeholder="to 0x..." value={mTo} onChange={setMTo} />
          <Input placeholder="예) 100" value={mAmt} onChange={setMAmt} />
          <Action
            disabled={!isConnected || !isAddress(mTo) || !mAmt || !isOwner || isPending}
            onClick={doMint}
            label="mint 실행"
            note={!isConnected ? '지갑 연결 후 실행하세요.' : !isOwner ? '컨트랙트 owner 지갑으로만 호출됩니다.' : ''}
          />
        </Card>
      </section>

      <Card title="트랜잭션 상태">
        <Row label="last hash">
          {hash ? (
            <a
              className="font-mono underline text-blue-600"
              href={`https://sepolia.etherscan.io/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
            >
              {short(hash, 10)}
            </a>
          ) : (
            '—'
          )}
        </Row>
        <Row label="status">
          {isPending
            ? '서명 대기'
            : isMining
            ? '채굴 대기'
            : isMined
            ? '✅ 완료'
            : '대기'}
        </Row>
        <button className="mt-2 rounded border px-3 py-1 text-sm" onClick={() => reset()}>
          상태 초기화
        </button>
      </Card>

      <p className="text-xs text-zinc-400 pt-8">
        지갑 연결 후 `transfer`, `approve`, `allowance`, `mint` 등을 테스트할 수 있습니다.
      </p>
    </main>
  )
}

// ──────────── 공용 UI 컴포넌트 ─────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-2xl p-4 space-y-2 bg-white shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  )
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono">{children}</span>
    </div>
  )
}
function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      className="w-full border rounded px-2 py-1 text-sm font-mono"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
function Action({
  onClick,
  disabled,
  label,
  note,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  note?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        className="rounded bg-zinc-900 text-white px-3 py-1 text-sm disabled:opacity-40"
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </button>
      {note && <span className="text-xs text-zinc-500">{note}</span>}
    </div>
  )
}
function short(s: string, n = 6) {
  return `${s.slice(0, n)}…${s.slice(-4)}`
}
