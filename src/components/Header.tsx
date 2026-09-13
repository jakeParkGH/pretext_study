import React from 'react'

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-top">
        <div className="header-title-area">
          <h1>
            ⚡ Pretext 실습 & 아키텍처 학습용 React 샌드박스
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="header-badge">@chenglou/pretext</span>
          <span className="header-badge" style={{ borderColor: 'rgba(63, 185, 80, 0.4)', color: '#3fb950', background: 'rgba(63, 185, 80, 0.1)' }}>
            Zero DOM Reflow
          </span>
        </div>
      </div>
      <p className="header-desc">
        Cheng Lou가 설계한 순수 연산 기반 텍스트 레이아웃 엔진의 원리와 문제 해결 패턴을 직접 조작하고,
        실제 로컬 패키지 소스코드 기반의 상세 주석과 함께 학습할 수 있는 인터랙티브 데모입니다.
      </p>
    </header>
  )
}
