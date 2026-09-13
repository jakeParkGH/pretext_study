import React, { useState } from 'react'
import { Highlight, themes } from 'prism-react-renderer'

export interface CodeSnippet {
  tabLabel: string
  title?: string
  filePath?: string
  language?: string
  code: string
  explanation: string
}

interface CodeViewerProps {
  title: string
  snippets?: CodeSnippet[]
  filePath?: string
  code?: string
  explanation?: string
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  title,
  snippets,
  filePath,
  code,
  explanation,
}) => {
  const [copied, setCopied] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const [activeSnippetIndex, setActiveSnippetIndex] = useState(0)

  // snippets 배열이 있으면 사용하고, 없으면 단일 prop들로 배열 구성
  const allSnippets: CodeSnippet[] =
    snippets && snippets.length > 0
      ? snippets
      : [
          {
            tabLabel: '코드',
            title,
            filePath,
            code: code || '',
            explanation: explanation || '',
          },
        ]

  const currentSnippet = allSnippets[activeSnippetIndex] || allSnippets[0]!

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSnippet.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="code-viewer-container">
      <div className="code-viewer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#58a6ff' }}>
            📖 {title}
          </span>

          {/* 탭 버튼들 (컴포넌트 코드 vs 라이브러리 내부 코드) */}
          {allSnippets.length > 1 && (
            <div
              className="hide-scrollbar"
              style={{
                display: 'flex',
                gap: '4px',
                background: '#090d13',
                padding: '2px',
                borderRadius: '6px',
                border: '1px solid #30363d',
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              {allSnippets.map((snippet, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSnippetIndex(idx)}
                  style={{
                    border: 'none',
                    background: activeSnippetIndex === idx ? '#21262d' : 'transparent',
                    color: activeSnippetIndex === idx ? '#f0f6fc' : '#8b949e',
                    fontSize: '11.5px',
                    fontWeight: activeSnippetIndex === idx ? 700 : 500,
                    padding: '4px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {snippet.tabLabel}
                </button>
              ))}
            </div>
          )}

          {currentSnippet.filePath && (
            <span className="code-file-name">({currentSnippet.filePath})</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? '접기' : '코드 펼치기'}
          </button>
          <button
            className={`btn ${copied ? 'btn-primary' : ''}`}
            onClick={handleCopy}
            style={{ minWidth: '85px', textAlign: 'center' }}
          >
            {copied ? '✓ 복사됨' : '코드 복사'}
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          <div
            style={{
              padding: '12px 16px',
              background: '#131822',
              borderBottom: '1px solid #30363d',
              fontSize: '13px',
              color: '#8b949e',
              lineHeight: 1.6,
            }}
          >
            💡 <strong style={{ color: '#f0f6fc' }}>핵심 최적화 포인트:</strong>{' '}
            {currentSnippet.explanation}
          </div>

          {/* prism-react-renderer 기반 가독성 극대화 및 안전한 하이라이팅 (No dangerouslySetInnerHTML) */}
          <Highlight
            theme={themes.vsDark}
            code={currentSnippet.code.trim()}
            language={currentSnippet.language || 'tsx'}
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={`${className} code-viewer-pre hide-scrollbar`}
                style={{
                  ...style,
                  margin: 0,
                  padding: '16px 0',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  fontSize: '12.5px',
                  lineHeight: '1.6',
                  background: '#0a0e14',
                  fontFamily: "'Fira Code', Menlo, Monaco, Consolas, monospace",
                }}
              >
                {tokens.map((line, i) => (
                  <div
                    key={i}
                    {...getLineProps({ line })}
                    className="code-line-row"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      padding: '0 16px',
                    }}
                  >
                    <span
                      className="code-line-number"
                      style={{
                        display: 'inline-block',
                        width: '32px',
                        minWidth: '32px',
                        paddingRight: '16px',
                        textAlign: 'right',
                        color: '#484f58',
                        userSelect: 'none',
                        fontSize: '11.5px',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="code-line-content"
                      style={{ flex: 1, whiteSpace: 'pre' }}
                    >
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </>
      )}
    </div>
  )
}
