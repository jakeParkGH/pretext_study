import React, { useState } from 'react'
import { Header } from './components/Header'
import { BasicMeasureDemo } from './demos/BasicMeasureDemo'
import { ChatBubbleDemo } from './demos/ChatBubbleDemo'
import { MasonryDemo } from './demos/MasonryDemo'
import { ShapeFlowDemo } from './demos/ShapeFlowDemo'
import { StreamingDemo } from './demos/StreamingDemo'

type DemoTab = 'basic' | 'bubble' | 'masonry' | 'shape' | 'streaming'

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DemoTab>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '')
      if (['basic', 'bubble', 'masonry', 'shape', 'streaming'].includes(hash)) {
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
          className={`tab-btn ${activeTab === 'bubble' ? 'active' : ''}`}
          onClick={() => handleTabChange('bubble')}
        >
          <span>💬</span> 2. 채팅 말풍선 여백 최적화 (이진 탐색)
        </button>
        <button
          className={`tab-btn ${activeTab === 'masonry' ? 'active' : ''}`}
          onClick={() => handleTabChange('masonry')}
        >
          <span>🧱</span> 3. 선제적 메이슨리 (Zero CLS)
        </button>
        <button
          className={`tab-btn ${activeTab === 'shape' ? 'active' : ''}`}
          onClick={() => handleTabChange('shape')}
        >
          <span>🌊</span> 4. 자유 형태 텍스트 플로우 (커서 라우팅)
        </button>
        <button
          className={`tab-btn ${activeTab === 'streaming' ? 'active' : ''}`}
          onClick={() => handleTabChange('streaming')}
        >
          <span>⚡</span> 5. LLM 토큰 스트리밍 & VSync 보호
        </button>
      </nav>

      {/* 액티브 탭 컴포넌트 렌더링 */}
      <main>
        {activeTab === 'basic' && <BasicMeasureDemo />}
        {activeTab === 'bubble' && <ChatBubbleDemo />}
        {activeTab === 'masonry' && <MasonryDemo />}
        {activeTab === 'shape' && <ShapeFlowDemo />}
        {activeTab === 'streaming' && <StreamingDemo />}
      </main>
    </div>
  )
}

export default App
