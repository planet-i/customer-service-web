import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './style.css';

const suggestions = ['我准备训练一个 7B 模型，如何选择 GPU？', '训练和推理需要的算力有什么区别？', 'GPU 任务失败时，需要准备哪些排查信息？'];

function App() {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeRequest = useRef(null);
  const end = useRef(null);
  const textarea = useRef(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy, error]);
  useEffect(() => () => activeRequest.current?.abort(), []);

  function reset() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setMessages([]);
    setSessionId('');
    setInput('');
    setBusy(false);
    setError('');
    textarea.current?.focus();
  }

  async function send(text = input) {
    const question = text.trim();
    if (!question || activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    setError('');
    setInput('');
    const turn = { role: 'user', content: question };
    setMessages(previous => [...previous, turn]);
    const timer = setTimeout(() => controller.abort(), 70000);
    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, ...(sessionId ? { session_id: sessionId } : {}) }),
        signal: controller.signal,
      });
      const body = await response.text();
      if (!response.ok) throw new Error(body.trim() || `请求失败（HTTP ${response.status}）`);
      let data;
      try { data = JSON.parse(body); } catch { throw new Error('服务返回了无法识别的内容，请稍后重试。'); }
      if (typeof data.reply !== 'string' || !data.reply.trim() || typeof data.session_id !== 'string' || !data.session_id) {
        throw new Error('服务响应缺少回复或会话 ID，请稍后重试。');
      }
      if (activeRequest.current !== controller) return;
      setSessionId(data.session_id);
      setMessages(previous => [...previous, { role: 'assistant', content: data.reply, references: Array.isArray(data.matched_faqs) ? data.matched_faqs.filter(item => item && typeof item.id === 'string' && typeof item.question === 'string') : [] }]);
    } catch (cause) {
      if (activeRequest.current !== controller) return;
      setMessages(previous => previous.filter(item => item !== turn));
      setInput(question);
      setError(cause.name === 'AbortError' ? '等待回复超时，请稍后重试。' : cause.message);
    } finally {
      clearTimeout(timer);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setBusy(false);
        requestAnimationFrame(() => textarea.current?.focus());
      }
    }
  }

  return (
    <div className="app">
      <aside>
        <a className="brand" href="/" aria-label="GPU 客服首页"><span className="logo">G</span><span>GPU SUPPORT<small>算力咨询助手</small></span></a>
        <button className="new-chat" onClick={reset}><span>＋</span> 开始新对话</button>
        <div className="side-label">服务范围</div>
        <ul className="services"><li>算力选型建议</li><li>训练与推理咨询</li><li>任务问题排查思路</li></ul>
        <div className="side-note"><span className="dot" /> 学习演示环境<p>平台价格、库存和政策请以官方资料为准。</p></div>
      </aside>
      <main>
        <header><div><span className="dot" /> GPU 智能客服<span className="badge">DEMO</span></div><button className="mobile-new" onClick={reset}>新对话 ＋</button><span className="header-note">中文 · 多轮对话</span></header>
        <div className="conversation">
          {messages.length === 0 && <section className="welcome"><div className="welcome-icon">✦</div><span className="eyebrow">YOUR COMPUTE ASSISTANT</span><h1>让算力选择，<br />更清楚一点。</h1><p>从你的任务开始，一起梳理模型规模、训练方式和算力需求。</p><div className="suggestions">{suggestions.map((text, index) => <button key={text} disabled={busy} onClick={() => send(text)}><span className="suggestion-index">0{index + 1}</span>{text}<span className="arrow">↗</span></button>)}</div></section>}
          <div className="messages" role="log" aria-label="聊天记录" aria-live="polite">
            {messages.map((message, index) => <article className={`message ${message.role}`} key={index}><div className="avatar">{message.role === 'user' ? '你' : 'G'}</div><div className="message-body"><div className="sender">{message.role === 'user' ? '你' : 'GPU 助手'}</div><div className={`bubble ${message.role === 'assistant' ? 'markdown' : ''}`}>{message.role === 'assistant' ? <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
                a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                table: ({ node, ...props }) => <div className="table-scroll"><table {...props} /></div>,
                img: ({ alt }) => <span className="image-placeholder">[图片：{alt || '未提供说明'}]</span>,
              }}>{message.content}</ReactMarkdown> : message.content}</div>
              {message.role === 'assistant' && message.references?.length > 0 && <details className="faq-references"><summary>本次参考资料 · {message.references.length} 条</summary><p>以下资料已提供给助手参考，回答仍需核实。</p><ul>{message.references.map(item => <li key={item.id}><span>{item.id}</span>{item.question}</li>)}</ul></details>}
            </div></article>)}
            {busy && <article className="message assistant"><div className="avatar">G</div><div className="message-body"><div className="sender">GPU 助手</div><div className="bubble thinking">正在思考<span>···</span></div></div></article>}
          </div>
          {error && <div className="error" role="alert">{error}<small>问题已保留在输入框。若会话已失效，请点击“开始新对话”。</small></div>}
          <div ref={end} />
        </div>
        <footer><form onSubmit={event => { event.preventDefault(); send(); }}><label className="sr-only" htmlFor="message">你的问题</label><textarea id="message" ref={textarea} value={input} disabled={busy} onChange={event => setInput(event.target.value)} placeholder="描述你的任务，或继续追问…" rows={2} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} /><div className="composer-bottom"><span>Enter 发送 · Shift + Enter 换行</span><button type="submit" disabled={busy || !input.trim()} aria-label="发送消息">{busy ? '等待回复' : '发送 ↗'}</button></div></form><p className="disclaimer">AI 回复仅供参考 · 不会查询订单或执行退款 · 新对话将清空当前聊天</p></footer>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
