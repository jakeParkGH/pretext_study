import React, { useState } from 'react'
import { Header } from './components/Header'
import { BasicMeasureDemo } from './demos/BasicMeasureDemo'
import { AccordionDemo } from './demos/AccordionDemo'
import { StreamingDemo } from './demos/StreamingDemo'
import { TanStackFeedDemo } from './demos/TanStackFeedDemo'
import { ShapeFlowDemo } from './demos/ShapeFlowDemo'

type DemoTab = 'basic' | 'accordion' | 'streaming' | 'feed' | 'shape'

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DemoTab>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '')
      if (['basic', 'accordion', 'streaming', 'feed', 'shape'].includes(hash)) {
        return hash as DemoTab
      }
    }
    return 'basic'
  })

  const handleTabChange = (tab: DemoTab) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      window.location.hash = tab
    }
  }

  return (
    <div className="app-container">
      <Header />

      {/* 탭 네비게이션 */}
      <nav className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => handleTabChange('basic')}
        >
          <span>❄️</span> 1. Cold/Hot Path 성능 측정
        </button>
        <button
          className={`tab-btn ${activeTab === 'accordion' ? 'active' : ''}`}
          onClick={() => handleTabChange('accordion')}
        >
          <span>🪗</span> 2. DOM 측정 없는 무결점 아코디언 (Zero Reflow)
        </button>
        <button
          className={`tab-btn ${activeTab === 'streaming' ? 'active' : ''}`}
          onClick={() => handleTabChange('streaming')}
        >
          <span>⚡</span> 3. LLM 토큰 스트리밍 & VSync 보호
        </button>
        <button
          className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => handleTabChange('feed')}
        >
          <span>📜</span> 4. TanStack 무한스크롤 & Transform 주입
        </button>
        <button
          className={`tab-btn ${activeTab === 'shape' ? 'active' : ''}`}
          onClick={() => handleTabChange('shape')}
        >
          <span>🌊</span> 5. 자유 형태 텍스트 플로우 (커서 라우팅)
        </button>
      </nav>

      {/* 액티브 탭 컴포넌트 렌더링 */}
      <main>
        {activeTab === 'basic' && <BasicMeasureDemo />}
        {activeTab === 'accordion' && <AccordionDemo />}
        {activeTab === 'streaming' && <StreamingDemo />}
        {activeTab === 'feed' && <TanStackFeedDemo />}
        {activeTab === 'shape' && <ShapeFlowDemo />}
      </main>
    </div>
  )
}

export default App
